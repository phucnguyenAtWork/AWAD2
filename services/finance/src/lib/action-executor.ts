/**
 * Action Executor — full CRUD for transactions & budgets via chat
 *
 * Parses the USER's prompt to detect intent, then executes the matching
 * database operation. Supports: create/update/delete transactions & budgets.
 */
import { TransactionsService } from "../services/transactions.service";
import { BudgetsService } from "../services/budgets.service";
import { db } from "../db";
import { categories } from "../schemas/categories.schema";
import { accounts } from "../schemas/accounts.schema";
import { transactions } from "../schemas/transactions.schema";
import { budgets } from "../schemas/budgets.schema";
import { eq, desc, and } from "drizzle-orm";

// ─── Types ──────────────────────────────────────────────────────────

export type ActionIntent =
  | "create_transaction"
  | "create_budget"
  | "update_transaction"
  | "update_budget"
  | "delete_transaction"
  | "delete_budget"
  | "list_transactions"
  | "list_budgets"
  | null;

export type FinaAction = {
  type: string;
  data: Record<string, unknown>;
};

export type ActionResult = {
  type: string;
  success: boolean;
  record?: unknown;
  error?: string;
};

// ─── DB Helpers ─────────────────────────────────────────────────────

async function getUserAccountId(userId: string): Promise<string | null> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  return account?.id ?? null;
}

async function resolveCategoryId(
  categoryName: string,
  accountId: string | null
): Promise<string | null> {
  const allCats = await db.select().from(categories);

  const exact = allCats.find(
    (c) =>
      c.name.toLowerCase() === categoryName.toLowerCase() &&
      (c.accountId === accountId || c.accountId === null)
  );
  if (exact) return exact.id;

  const partial = allCats.find(
    (c) =>
      c.name.toLowerCase().includes(categoryName.toLowerCase()) ||
      categoryName.toLowerCase().includes(c.name.toLowerCase())
  );
  if (partial) return partial.id;

  return null;
}

async function getLastTransaction(userId: string) {
  const [row] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.occurredAt))
    .limit(1);
  return row ?? null;
}

async function getLastBudget(userId: string) {
  const accountId = await getUserAccountId(userId);
  if (!accountId) return null;
  const [row] = await db
    .select()
    .from(budgets)
    .where(eq(budgets.accountId, accountId))
    .orderBy(desc(budgets.createdAt))
    .limit(1);
  return row ?? null;
}

// ─── Amount parsing ─────────────────────────────────────────────────

function parseAmount(text: string): number | null {
  // "3 triệu" / "3 million" / "3m" / "3tr"
  const milMatch = text.match(/(\d[\d.,]*)\s*(?:triệu|tr|million|mil|m)\b/i);
  if (milMatch) {
    const num = parseFloat(milMatch[1]!.replace(/,/g, "."));
    return isNaN(num) ? null : num * 1_000_000;
  }

  // "3.000.000" or "3,000,000"
  const bigMatch = text.match(/(\d{1,3}(?:[.,]\d{3})+)/);
  if (bigMatch) {
    const num = Number(bigMatch[1]!.replace(/\./g, "").replace(/,/g, ""));
    return isNaN(num) || num <= 0 ? null : num;
  }

  // "50k"
  const kMatch = text.match(/(\d+)\s*k\b/i);
  if (kMatch) {
    const num = Number(kMatch[1]!) * 1_000;
    return num > 0 ? num : null;
  }

  // plain number followed by VND/USD/đ
  const plainMatch = text.match(/(\d+)\s*(?:VND|USD|đ|dong)?\b/i);
  if (plainMatch) {
    const num = Number(plainMatch[1]!);
    // Only accept if reasonably large (likely currency amount)
    return num >= 1000 ? num : null;
  }

  return null;
}

// ─── Category detection ─────────────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  food: "Food", lunch: "Food", dinner: "Food", breakfast: "Food", meal: "Food",
  "ăn": "Food", "cơm": "Food", "bún": "Food", "phở": "Food", "cafe": "Food", coffee: "Food",
  shopping: "Shopping", clothes: "Shopping", clothing: "Shopping", "quần áo": "Shopping", "mua sắm": "Shopping", shoes: "Shopping",
  grocery: "Grocery", groceries: "Grocery", "siêu thị": "Grocery", supermarket: "Grocery",
  bill: "Bill", electricity: "Bill", water: "Bill", internet: "Bill", rent: "Bill", phone: "Bill",
  "điện": "Bill", "nước": "Bill", "tiền nhà": "Bill",
  transport: "Other", taxi: "Other", grab: "Other", fuel: "Other", gas: "Other", uber: "Other",
};

function detectCategory(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [keyword, cat] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(keyword)) return cat;
  }
  return null;
}

// ─── Intent detection from user prompt ──────────────────────────────

// CREATE TRANSACTION patterns
const CREATE_TX_PATTERNS = [
  /\b(?:i\s+)?(?:spent|spend|paid|bought|purchased|pay)\b/i,
  /\b(?:chi|chi tiêu|mua|trả|thanh toán|tiêu)\b/i,
  /\b(?:add|log|record|create)\b.*\b(?:expense|transaction|spending|income)\b/i,
  /\b(?:earned|received|got\s+paid|income|salary)\b/i,
  /\b(?:thu nhập|nhận|lương|thu)\b.*\b\d/i,
  /\blog\b.*\d/i,
];

// CREATE BUDGET patterns
const CREATE_BUDGET_PATTERNS = [
  /\b(?:set|create|add|make)\b.*\bbudget\b/i,
  /\bbudget\b.*\b(?:of|for|at|to)\b.*\d/i,
  /\b(?:tạo|đặt|thêm)\b.*\b(?:ngân sách|budget)\b/i,
];

// UPDATE patterns
const UPDATE_TX_PATTERNS = [
  /\b(?:update|change|edit|modify|fix)\b.*\b(?:transaction|expense|spending|income)\b/i,
  /\b(?:sửa|chỉnh|thay đổi)\b.*\b(?:giao dịch|chi tiêu)\b/i,
  /\b(?:update|change)\b.*\b(?:last|recent|previous)\b.*\b(?:transaction|expense)\b/i,
];

const UPDATE_BUDGET_PATTERNS = [
  /\b(?:update|change|edit|modify|adjust)\b.*\bbudget\b/i,
  /\b(?:sửa|chỉnh|thay đổi)\b.*\b(?:ngân sách|budget)\b/i,
];

// DELETE patterns
const DELETE_TX_PATTERNS = [
  /\b(?:delete|remove|cancel|undo)\b.*\b(?:transaction|expense|spending|income)\b/i,
  /\b(?:delete|remove)\b.*\b(?:last|recent|previous)\b/i,
  /\b(?:xóa|hủy|bỏ)\b.*\b(?:giao dịch|chi tiêu)\b/i,
];

const DELETE_BUDGET_PATTERNS = [
  /\b(?:delete|remove|cancel)\b.*\bbudget\b/i,
  /\b(?:xóa|hủy|bỏ)\b.*\b(?:ngân sách|budget)\b/i,
];

// QUESTION patterns — these should NOT trigger any action
const QUESTION_PATTERNS = [
  /\bhow much\b/i, /\bcan i\b/i, /\bshould i\b/i, /\bwhat\b.*\bspend/i,
  /\bcompare\b/i, /\bsummary\b/i, /\banalyze\b/i, /\badvice\b/i, /\bsuggest\b/i,
  /\btell me\b/i, /\bshow me\b/i, /\bwhat is\b/i, /\bwhat are\b/i,
  /^who\b/i, /^where\b/i, /^when\b/i, /^why\b/i,
];

function detectIntent(userPrompt: string): ActionIntent {
  const p = userPrompt.trim();

  // Questions never trigger actions
  if (QUESTION_PATTERNS.some((re) => re.test(p))) return null;

  // Delete — check before create (e.g. "delete last transaction")
  if (DELETE_TX_PATTERNS.some((re) => re.test(p))) return "delete_transaction";
  if (DELETE_BUDGET_PATTERNS.some((re) => re.test(p))) return "delete_budget";

  // Update
  if (UPDATE_TX_PATTERNS.some((re) => re.test(p))) return "update_transaction";
  if (UPDATE_BUDGET_PATTERNS.some((re) => re.test(p))) return "update_budget";

  // Create budget — check before transaction (e.g. "set budget of 5m for food")
  if (CREATE_BUDGET_PATTERNS.some((re) => re.test(p))) return "create_budget";

  // Create transaction
  if (CREATE_TX_PATTERNS.some((re) => re.test(p))) return "create_transaction";

  return null;
}

function isIncomeIntent(prompt: string): boolean {
  return /\b(?:earned|received|got\s+paid|income|salary|thu nhập|nhận|lương)\b/i.test(prompt);
}

/**
 * Extract a clean description from the user prompt.
 * Strips out intent verbs, amounts, currency, and filler words.
 * "I spent 3 million vnd on shopping clothes" → "shopping clothes"
 * "log 50k lunch" → "lunch"
 */
function extractDescription(prompt: string): string {
  let text = prompt.trim();

  // Remove intent verbs / filler at the start
  text = text.replace(
    /^(?:i\s+)?(?:spent|spend|paid|bought|purchased|pay|earned|received|got\s+paid|log|add|record|create)\s+/i,
    ""
  );
  // Vietnamese intent verbs
  text = text.replace(
    /^(?:tôi\s+)?(?:chi|chi tiêu|mua|trả|thanh toán|tiêu|thu nhập|nhận)\s+/i,
    ""
  );

  // Remove amount patterns: "3 triệu", "3m", "3.000.000", "50k", "500000"
  text = text.replace(/\d[\d.,]*\s*(?:triệu|tr|million|mil|m|k|VND|USD|đ|dong)\b/gi, "");
  text = text.replace(/\d{1,3}(?:[.,]\d{3})+/g, "");
  text = text.replace(/\b\d{4,}\b/g, ""); // bare large numbers

  // Remove filler prepositions
  text = text.replace(/\b(?:on|for|into|in|to|at|of|about|this\s+month|today|yesterday|vào|cho|để)\b/gi, "");

  // Remove "expense" / "income" / "transaction" labels
  text = text.replace(/\b(?:expense|income|transaction|spending)\b/gi, "");

  // Collapse whitespace and trim
  text = text.replace(/\s+/g, " ").trim();

  // Remove leading/trailing punctuation
  text = text.replace(/^[,.\-–—:;]+|[,.\-–—:;]+$/g, "").trim();

  return text || "Transaction";
}

// ─── Execute based on user prompt ───────────────────────────────────

export async function executeFromPrompt(
  userPrompt: string,
  userId: string
): Promise<ActionResult | null> {
  const intent = detectIntent(userPrompt);
  if (!intent) return null;

  const accountId = await getUserAccountId(userId);

  try {
    switch (intent) {
      // ── CREATE TRANSACTION ──────────────────────────────────────
      case "create_transaction": {
        const amount = parseAmount(userPrompt);
        if (!amount) return null; // can't create without amount

        const txType = isIncomeIntent(userPrompt) ? "INCOME" : "EXPENSE";
        const categoryName = detectCategory(userPrompt);
        const categoryId = categoryName && accountId
          ? await resolveCategoryId(categoryName, accountId)
          : null;

        const description = extractDescription(userPrompt);

        const record = await TransactionsService.create({
          userId,
          type: txType,
          amount,
          currency: "VND",
          description,
          categoryId,
          essential: false,
          tags: null,
          occurredAt: new Date().toISOString(),
        });

        return {
          type: "create_transaction",
          success: true,
          record: {
            id: record.id,
            type: record.type,
            amount: record.amount,
            currency: record.currency,
            description: record.description,
            categoryId: record.categoryId,
            categoryName: categoryName ?? "Other",
            occurredAt: record.occurredAt,
          },
        };
      }

      // ── CREATE BUDGET ───────────────────────────────────────────
      case "create_budget": {
        if (!accountId) return { type: "create_budget", success: false, error: "No account found" };

        const amount = parseAmount(userPrompt);
        if (!amount) return null;

        const categoryName = detectCategory(userPrompt);
        const categoryId = categoryName
          ? await resolveCategoryId(categoryName, accountId)
          : null;

        // Default to monthly, starting now through end of month
        const now = new Date();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const period = /\bweekly\b|tuần/i.test(userPrompt) ? "WEEKLY" : "MONTHLY";

        const record = await BudgetsService.create({
          accountId,
          categoryId,
          amountLimit: amount,
          period,
          alertThreshold: 0.8,
          startDate: now.toISOString().split("T")[0]!,
          endDate: endOfMonth.toISOString().split("T")[0]!,
        });

        return {
          type: "create_budget",
          success: true,
          record: {
            id: record.id,
            amountLimit: record.amountLimit,
            period: record.period,
            categoryName: categoryName ?? "All",
            startDate: record.startDate,
            endDate: record.endDate,
          },
        };
      }

      // ── UPDATE TRANSACTION ──────────────────────────────────────
      case "update_transaction": {
        const last = await getLastTransaction(userId);
        if (!last) return { type: "update_transaction", success: false, error: "No transaction found to update" };

        const updates: Record<string, unknown> = {};
        const newAmount = parseAmount(userPrompt);
        if (newAmount) updates.amount = newAmount;

        const newCat = detectCategory(userPrompt);
        if (newCat && accountId) {
          const catId = await resolveCategoryId(newCat, accountId);
          if (catId) updates.categoryId = catId;
        }

        if (isIncomeIntent(userPrompt)) updates.type = "INCOME";
        else if (/\bexpense\b/i.test(userPrompt)) updates.type = "EXPENSE";

        if (Object.keys(updates).length === 0) {
          return { type: "update_transaction", success: false, error: "Could not determine what to update" };
        }

        const record = await TransactionsService.update(last.id, updates as any);
        return {
          type: "update_transaction",
          success: true,
          record: {
            id: record?.id,
            type: record?.type,
            amount: record?.amount,
            description: record?.description,
          },
        };
      }

      // ── UPDATE BUDGET ───────────────────────────────────────────
      case "update_budget": {
        const lastBudget = await getLastBudget(userId);
        if (!lastBudget) return { type: "update_budget", success: false, error: "No budget found to update" };

        const updates: Record<string, unknown> = {};
        const newAmount = parseAmount(userPrompt);
        if (newAmount) updates.amountLimit = newAmount;

        const period = /\bweekly\b|tuần/i.test(userPrompt) ? "WEEKLY" : /\bmonthly\b|tháng/i.test(userPrompt) ? "MONTHLY" : undefined;
        if (period) updates.period = period;

        if (Object.keys(updates).length === 0) {
          return { type: "update_budget", success: false, error: "Could not determine what to update" };
        }

        const record = await BudgetsService.update(lastBudget.id, updates as any);
        return {
          type: "update_budget",
          success: true,
          record: {
            id: record?.id,
            amountLimit: record?.amountLimit,
            period: record?.period,
          },
        };
      }

      // ── DELETE TRANSACTION ──────────────────────────────────────
      case "delete_transaction": {
        const last = await getLastTransaction(userId);
        if (!last) return { type: "delete_transaction", success: false, error: "No transaction found to delete" };

        await TransactionsService.delete(last.id);
        return {
          type: "delete_transaction",
          success: true,
          record: {
            id: last.id,
            type: last.type,
            amount: last.amount,
            description: last.description,
          },
        };
      }

      // ── DELETE BUDGET ───────────────────────────────────────────
      case "delete_budget": {
        const lastBudget = await getLastBudget(userId);
        if (!lastBudget) return { type: "delete_budget", success: false, error: "No budget found to delete" };

        await BudgetsService.delete(lastBudget.id);
        return {
          type: "delete_budget",
          success: true,
          record: { id: lastBudget.id, amountLimit: lastBudget.amountLimit },
        };
      }

      default:
        return null;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { type: intent, success: false, error: msg };
  }
}
