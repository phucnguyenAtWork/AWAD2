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
import { eq, desc, and, isNull } from "drizzle-orm";

// ─── Types ──────────────────────────────────────────────────────────

export type ActionIntent =
  | "create_transaction"
  | "create_budget"
  | "update_transaction"
  | "update_budget"
  | "delete_transaction"
  | "delete_transactions_range"
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

/**
 * Guarantees a non-Uncategorized category for a logged transaction.
 *   1. If a name is supplied, try resolving it directly.
 *   2. Otherwise (or if step 1 misses), run the keyword map over every
 *      free-text hint we have (model-supplied category, item, raw prompt).
 *   3. As a last resort, fall back to the account's "Other" category.
 *      "Uncategorized" is explicitly skipped so logs never land there.
 */
async function resolveCategoryIdOrDefault(
  hints: { categoryName?: string | null; item?: string | null; prompt?: string | null },
  accountId: string | null
): Promise<string | null> {
  if (!accountId) return null;

  if (hints.categoryName) {
    const direct = await resolveCategoryId(hints.categoryName, accountId);
    if (direct) {
      const [row] = await db.select().from(categories).where(eq(categories.id, direct)).limit(1);
      if (row && row.name.toLowerCase() !== "uncategorized") return direct;
    }
  }

  const blob = [hints.categoryName, hints.item, hints.prompt].filter(Boolean).join(" ");
  const keywordHit = blob ? detectCategory(blob) : null;
  if (keywordHit) {
    const id = await resolveCategoryId(keywordHit, accountId);
    if (id) return id;
  }

  const fallback = await resolveCategoryId("Other", accountId);
  return fallback;
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

// Keywords are scanned in insertion order; the first match wins.
// Keep multi-word/more-specific phrases ABOVE single words that could be a prefix
// (e.g. "gym membership" -> Bill must come before a bare "gym" rule).
const CATEGORY_MAP: Record<string, string> = {
  // ── Food (eating out, drinks, snacks) ──
  food: "Food", lunch: "Food", dinner: "Food", breakfast: "Food", meal: "Food", snack: "Food",
  drink: "Food", beer: "Food", tea: "Food",
  "ăn": "Food", "cơm": "Food", "bún": "Food", "phở": "Food", "mì": "Food", "xôi": "Food", "chè": "Food",
  cafe: "Food", coffee: "Food", "cà phê": "Food", "trà sữa": "Food", "bia": "Food", "nước ngọt": "Food",

  // ── Grocery (ingredients, household staples) ──
  grocery: "Grocery", groceries: "Grocery", supermarket: "Grocery",
  vegetable: "Grocery", vegetables: "Grocery", fruit: "Grocery", fruits: "Grocery",
  meat: "Grocery", milk: "Grocery", egg: "Grocery", eggs: "Grocery", rice: "Grocery",
  "siêu thị": "Grocery", "rau": "Grocery", "trái cây": "Grocery", "thịt": "Grocery",
  "sữa": "Grocery", "trứng": "Grocery", "gạo": "Grocery",

  // ── Bill (recurring / utilities / subscriptions — must be BEFORE generic Shopping words) ──
  "phone bill": "Bill", "gym membership": "Bill",
  bill: "Bill", electricity: "Bill", water: "Bill", internet: "Bill", rent: "Bill",
  subscription: "Bill", netflix: "Bill", spotify: "Bill", youtube: "Bill",
  insurance: "Bill", tuition: "Bill",
  phone: "Bill", // legacy: "phone" tends to mean phone bill in VN finance context
  "điện": "Bill", "nước": "Bill", "tiền nhà": "Bill", "bảo hiểm": "Bill", "học phí": "Bill",

  // ── Shopping (one-off purchases of goods) ──
  shopping: "Shopping", clothes: "Shopping", clothing: "Shopping", shoes: "Shopping",
  skincare: "Shopping", cosmetics: "Shopping", cosmetic: "Shopping", makeup: "Shopping",
  beauty: "Shopping", lotion: "Shopping", serum: "Shopping", perfume: "Shopping",
  book: "Shopping", books: "Shopping",
  laptop: "Shopping", iphone: "Shopping", android: "Shopping", smartphone: "Shopping",
  electronics: "Shopping", gadget: "Shopping", headphone: "Shopping", earphone: "Shopping",
  handbag: "Shopping", wallet: "Shopping", watch: "Shopping",
  "quần áo": "Shopping", "mua sắm": "Shopping", "giày": "Shopping",
  "mỹ phẩm": "Shopping", "son": "Shopping", "kem dưỡng": "Shopping",
  "sách": "Shopping", "túi xách": "Shopping", "ví": "Shopping", "đồng hồ": "Shopping",
  "máy tính": "Shopping", "điện thoại": "Shopping", "đồ điện tử": "Shopping",

  // ── Transport (maps to "Other" — no Transport category is seeded yet, so these
  //     still land as Uncategorized until you add one to categories.repository.ts).
  transport: "Other", taxi: "Other", grab: "Other", uber: "Other",
  fuel: "Other", gas: "Other", "xăng": "Other",
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

// DELETE-RANGE patterns — bulk delete by month/last-month/explicit range.
// Checked BEFORE single-row delete so "remove all transactions from last month"
// dispatches to a real batch delete instead of nuking one row and lying about it.
const DELETE_RANGE_PATTERNS = [
  /\b(?:delete|remove|clear|wipe)\b.*\b(?:all|every|everything)\b.*\btransactions?\b/i,
  /\b(?:delete|remove|clear)\b.*\btransactions?\b.*\b(?:from|between|in)\b/i,
  /\b(?:delete|remove|clear)\b.*\b(?:last|previous|prior|past|this|current)\s+month\b/i,
  /\b(?:xóa|hủy|bỏ)\b.*\b(?:tất cả|toàn bộ)\b.*\b(?:giao dịch|chi tiêu)\b/i,
  /\b(?:xóa|hủy|bỏ)\b.*\btháng\s+(?:trước|này|vừa\s+rồi|vừa\s+qua|rồi|hiện\s+tại)\b/i,
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

// ─── Date-range parsing ─────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x;
}

/**
 * Returns [from, to] inclusive based on the prompt, or null if no range
 * could be inferred. Supports "last month" / "this month", explicit
 * "MM/DD/YYYY to MM/DD/YYYY" (also dashes / VN "đến" / "tới"), and
 * "in <Month> [Year]". Falls back to DD/MM if MM/DD parses to an invalid
 * or inverted range.
 */
function parseDateRange(prompt: string, now = new Date()): { from: Date; to: Date } | null {
  const p = prompt.toLowerCase();

  // "last month" synonyms (EN + VN). Covers: last/previous/prior month,
  // "the month before", "month prior", "tháng trước/vừa rồi/vừa qua/rồi".
  if (
    /\b(?:last|previous|prior|past)\s+month\b/.test(p) ||
    /\bthe\s+month\s+(?:before|prior)\b/.test(p) ||
    /\bmonth\s+(?:before|prior)\b/.test(p) ||
    /\btháng\s+(?:trước|vừa\s+rồi|vừa\s+qua|rồi)\b/.test(p)
  ) {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: startOfDay(from), to: endOfDay(to) };
  }

  // "this month" synonyms (EN + VN). Covers: this/current/the current month,
  // "so far this month", "tháng này/hiện tại/hiện nay".
  if (
    /\b(?:this|current)\s+month\b/.test(p) ||
    /\bthe\s+current\s+month\b/.test(p) ||
    /\btháng\s+(?:này|hiện\s+tại|hiện\s+nay)\b/.test(p)
  ) {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: startOfDay(from), to: endOfDay(to) };
  }

  const explicit = prompt.match(
    /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\s*(?:[-–to]+|đến|tới)\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/i
  );
  if (explicit) {
    const [, a1, a2, ay, b1, b2, by] = explicit;
    const tryParse = (m: string, d: string, y: string) => {
      const dt = new Date(Number(y), Number(m) - 1, Number(d));
      return isNaN(dt.getTime()) || dt.getMonth() !== Number(m) - 1 ? null : dt;
    };
    let from = tryParse(a1!, a2!, ay!);
    let to = tryParse(b1!, b2!, by!);
    if (!from || !to || from > to) {
      from = tryParse(a2!, a1!, ay!);
      to = tryParse(b2!, b1!, by!);
    }
    if (from && to && from <= to) return { from: startOfDay(from), to: endOfDay(to) };
  }

  const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  const monthMatch = p.match(/\b(?:in|during)\s+(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(\d{4}))?/i);
  if (monthMatch) {
    const m = months.indexOf(monthMatch[1]!.toLowerCase());
    const y = monthMatch[2] ? Number(monthMatch[2]) : now.getFullYear();
    const from = new Date(y, m, 1);
    const to = new Date(y, m + 1, 0);
    return { from: startOfDay(from), to: endOfDay(to) };
  }

  return null;
}

function detectIntent(userPrompt: string): ActionIntent {
  const p = userPrompt.trim();

  // Questions never trigger actions
  if (QUESTION_PATTERNS.some((re) => re.test(p))) return null;

  // Delete-range — check BEFORE single delete so bulk wording dispatches to batch.
  if (DELETE_RANGE_PATTERNS.some((re) => re.test(p))) return "delete_transactions_range";

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
        const categoryId = await resolveCategoryIdOrDefault(
          { categoryName, prompt: userPrompt },
          accountId
        );

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

        const resolvedName = record.categoryId
          ? (await db.select().from(categories).where(eq(categories.id, record.categoryId)).limit(1))[0]?.name
          : null;

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
            categoryName: resolvedName ?? categoryName ?? "Other",
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

        const [existingBudget] = await db
          .select()
          .from(budgets)
          .where(
            and(
              eq(budgets.accountId, accountId),
              categoryId ? eq(budgets.categoryId, categoryId) : isNull(budgets.categoryId),
              eq(budgets.period, period)
            )
          )
          .limit(1);

        const record = existingBudget
          ? await BudgetsService.update(existingBudget.id, {
              amountLimit: amount,
              alertThreshold: 0.8,
              startDate: now.toISOString().split("T")[0]!,
              endDate: endOfMonth.toISOString().split("T")[0]!,
            })
          : await BudgetsService.create({
              accountId,
              categoryId,
              amountLimit: amount,
              period,
              alertThreshold: 0.8,
              startDate: now.toISOString().split("T")[0]!,
              endDate: endOfMonth.toISOString().split("T")[0]!,
            });

        if (!record) {
          return { type: "create_budget", success: false, error: "Budget could not be saved" };
        }

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

      // ── DELETE TRANSACTIONS IN A DATE RANGE ─────────────────────
      case "delete_transactions_range": {
        const range = parseDateRange(userPrompt);
        if (!range) {
          return {
            type: "delete_transactions_range",
            success: false,
            error: "Could not parse a date range. Try 'last month' or 'from 03/01/2026 to 03/31/2026'.",
          };
        }
        const result = await TransactionsService.deleteRange(userId, range.from, range.to);
        return {
          type: "delete_transactions_range",
          success: true,
          record: {
            from: range.from.toISOString(),
            to: range.to.toISOString(),
            count: result.count,
            totalAmount: result.totalAmount,
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

// ─── Execute from a structured FINA action ──────────────────────────
// FINA emits actions as { type, arguments }. The model has full conversation
// history, so this path handles follow-up turns ("food, 3.6m") that
// executeFromPrompt's single-turn regex misses.

const ACTION_TYPE_MAP: Record<string, ActionIntent> = {
  LOG_EXPENSE: "create_transaction",
  LOG_INCOME: "create_transaction",
  UPDATE_TRANSACTION: "update_transaction",
  DELETE_TRANSACTION: "delete_transaction",
  DELETE_TRANSACTIONS_RANGE: "delete_transactions_range",
  create_transaction: "create_transaction",
  update_transaction: "update_transaction",
  delete_transaction: "delete_transaction",
  delete_transactions_range: "delete_transactions_range",
  create_budget: "create_budget",
  update_budget: "update_budget",
  delete_budget: "delete_budget",
};

export async function executeFromAction(
  action: { type?: string; arguments?: Record<string, unknown> },
  userId: string
): Promise<ActionResult | null> {
  const rawType = typeof action?.type === "string" ? action.type : "";
  const intent = ACTION_TYPE_MAP[rawType] ?? null;
  if (!intent) return null;

  const args = (action.arguments ?? {}) as Record<string, unknown>;
  const accountId = await getUserAccountId(userId);
  const amount = typeof args.amount === "number" ? args.amount : null;
  const categoryName = typeof args.category === "string" && args.category ? args.category : null;
  const item = typeof args.item === "string" && args.item ? args.item : null;

  try {
    switch (intent) {
      case "create_transaction": {
        if (!amount) return { type: "create_transaction", success: false, error: "amount required" };
        const txType = rawType === "LOG_INCOME" ? "INCOME" : "EXPENSE";
        const categoryId = await resolveCategoryIdOrDefault(
          { categoryName, item },
          accountId
        );
        const record = await TransactionsService.create({
          userId,
          type: txType,
          amount,
          currency: "VND",
          description: item ?? categoryName ?? "Transaction",
          categoryId,
          essential: false,
          tags: null,
          occurredAt: new Date().toISOString(),
        });
        const resolvedName = record.categoryId
          ? (await db.select().from(categories).where(eq(categories.id, record.categoryId)).limit(1))[0]?.name
          : null;
        return {
          type: "create_transaction",
          success: true,
          record: {
            id: record.id, type: record.type, amount: record.amount,
            currency: record.currency, description: record.description,
            categoryId: record.categoryId, categoryName: resolvedName ?? categoryName ?? "Other",
            occurredAt: record.occurredAt,
          },
        };
      }

      case "create_budget": {
        if (!accountId) return { type: "create_budget", success: false, error: "No account found" };
        if (!amount) return { type: "create_budget", success: false, error: "amount required" };
        const categoryId = categoryName ? await resolveCategoryId(categoryName, accountId) : null;
        const period = (typeof args.period === "string" && /^(MONTHLY|WEEKLY)$/.test(args.period))
          ? (args.period as "MONTHLY" | "WEEKLY")
          : "MONTHLY";
        const alertThreshold = typeof args.alert_threshold === "number" ? args.alert_threshold : 0.8;
        const now = new Date();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const [existingBudget] = await db
          .select()
          .from(budgets)
          .where(
            and(
              eq(budgets.accountId, accountId),
              categoryId ? eq(budgets.categoryId, categoryId) : isNull(budgets.categoryId),
              eq(budgets.period, period)
            )
          )
          .limit(1);

        const record = existingBudget
          ? await BudgetsService.update(existingBudget.id, {
              amountLimit: amount,
              alertThreshold,
              startDate: now.toISOString().split("T")[0]!,
              endDate: endOfMonth.toISOString().split("T")[0]!,
            })
          : await BudgetsService.create({
              accountId, categoryId, amountLimit: amount, period, alertThreshold,
              startDate: now.toISOString().split("T")[0]!,
              endDate: endOfMonth.toISOString().split("T")[0]!,
            });

        if (!record) return { type: "create_budget", success: false, error: "Budget could not be saved" };
        return {
          type: "create_budget",
          success: true,
          record: {
            id: record.id, amountLimit: record.amountLimit, period: record.period,
            categoryName: categoryName ?? "All",
            startDate: record.startDate, endDate: record.endDate,
          },
        };
      }

      case "update_transaction": {
        const ref = typeof args.transaction_ref === "string" ? args.transaction_ref : null;
        const target = ref
          ? (await db.select().from(transactions).where(eq(transactions.id, ref)).limit(1))[0]
          : await getLastTransaction(userId);
        if (!target) return { type: "update_transaction", success: false, error: "No transaction found to update" };

        const updates: Record<string, unknown> = {};
        if (amount) updates.amount = amount;
        if (categoryName && accountId) {
          const catId = await resolveCategoryId(categoryName, accountId);
          if (catId) updates.categoryId = catId;
        }
        if (item) updates.description = item;
        if (Object.keys(updates).length === 0) {
          return { type: "update_transaction", success: false, error: "No fields to update" };
        }
        const record = await TransactionsService.update(target.id, updates as any);
        return {
          type: "update_transaction",
          success: true,
          record: { id: record?.id, type: record?.type, amount: record?.amount, description: record?.description },
        };
      }

      case "update_budget": {
        const ref = typeof args.budget_ref === "string" ? args.budget_ref : null;
        const target = ref
          ? (await db.select().from(budgets).where(eq(budgets.id, ref)).limit(1))[0]
          : await getLastBudget(userId);
        if (!target) return { type: "update_budget", success: false, error: "No budget found to update" };

        const updates: Record<string, unknown> = {};
        if (amount) updates.amountLimit = amount;
        if (typeof args.period === "string" && /^(MONTHLY|WEEKLY)$/.test(args.period)) updates.period = args.period;
        if (typeof args.alert_threshold === "number") updates.alertThreshold = args.alert_threshold;
        if (Object.keys(updates).length === 0) {
          return { type: "update_budget", success: false, error: "No fields to update" };
        }
        const record = await BudgetsService.update(target.id, updates as any);
        return {
          type: "update_budget",
          success: true,
          record: { id: record?.id, amountLimit: record?.amountLimit, period: record?.period },
        };
      }

      case "delete_transaction": {
        const ref = typeof args.transaction_ref === "string" ? args.transaction_ref : null;
        const target = ref
          ? (await db.select().from(transactions).where(eq(transactions.id, ref)).limit(1))[0]
          : await getLastTransaction(userId);
        if (!target) return { type: "delete_transaction", success: false, error: "No transaction found to delete" };
        await TransactionsService.delete(target.id);
        return {
          type: "delete_transaction",
          success: true,
          record: { id: target.id, type: target.type, amount: target.amount, description: target.description },
        };
      }

      case "delete_transactions_range": {
        // FINA may emit explicit ISO dates (preferred) or a free-text "range_text"
        // (e.g. "last month") that we run through parseDateRange().
        let from: Date | null = null;
        let to: Date | null = null;

        if (typeof args.from === "string" && typeof args.to === "string") {
          const f = new Date(args.from);
          const t = new Date(args.to);
          if (!isNaN(f.getTime()) && !isNaN(t.getTime()) && f <= t) {
            from = startOfDay(f); to = endOfDay(t);
          }
        }
        if ((!from || !to) && typeof args.range_text === "string") {
          const parsed = parseDateRange(args.range_text);
          if (parsed) { from = parsed.from; to = parsed.to; }
        }
        if (!from || !to) {
          return {
            type: "delete_transactions_range",
            success: false,
            error: "Range required: provide from + to ISO dates or a parseable range_text.",
          };
        }

        const result = await TransactionsService.deleteRange(userId, from, to);
        return {
          type: "delete_transactions_range",
          success: true,
          record: {
            from: from.toISOString(),
            to: to.toISOString(),
            count: result.count,
            totalAmount: result.totalAmount,
          },
        };
      }

      case "delete_budget": {
        const ref = typeof args.budget_ref === "string" ? args.budget_ref : null;
        const target = ref
          ? (await db.select().from(budgets).where(eq(budgets.id, ref)).limit(1))[0]
          : await getLastBudget(userId);
        if (!target) return { type: "delete_budget", success: false, error: "No budget found to delete" };
        await BudgetsService.delete(target.id);
        return {
          type: "delete_budget",
          success: true,
          record: { id: target.id, amountLimit: target.amountLimit },
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
