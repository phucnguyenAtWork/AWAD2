/**
 * FINA Integration Controller
 *
 * Data routes that the Windows FINA Brain calls to fetch financial data,
 * plus callback endpoints where FINA pushes AI results back.
 *
 * Prefix: /api/fina
 */
import { Elysia, t } from "elysia";
import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "../db";
import { accounts } from "../schemas/accounts.schema";
import { transactions } from "../schemas/transactions.schema";
import { categories } from "../schemas/categories.schema";
import { budgets } from "../schemas/budgets.schema";
import { categoryBudgets } from "../schemas/category-budgets.schema";
import { budgetPreferences } from "../schemas/budget-preferences.schema";
import { fina } from "../lib/fina-client";
import { executeFromPrompt, type ActionResult } from "../lib/action-executor";
import { authGuardConfig, resolveUserId } from "../middleware/requireAuth";
import { createPool } from "mysql2/promise";
import { env } from "../env";

// ─── In-memory forecast cache (per-user) ─────────────────────────────
const forecastCache = new Map<
  string,
  { weekly: unknown; monthly: unknown; confidence: number; source: string; cachedAt: Date }
>();

export const finaController = new Elysia({ prefix: "/api/fina" })

  // ─── User profile (FINA needs role + currency) ───────────────────
  .get(
    "/users/:userId",
    async ({ params, set }) => {
      const [account] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, params.userId))
        .limit(1);

      if (!account) {
        set.status = 404;
        return { message: "User not found" };
      }

      return {
        id: params.userId,
        name: account.name,
        currency: account.currency,
        role: account.role,
        accountId: account.id,
        accountType: account.type,
      };
    },
    {
      params: t.Object({ userId: t.String() }),
      detail: { tags: ["FINA Integration"], summary: "Get user profile for FINA" },
    }
  )

  // ─── User accounts list ──────────────────────────────────────────
  .get(
    "/users/:userId/accounts",
    async ({ params }) => {
      const rows = await db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, params.userId));

      return {
        accounts: rows.map((a) => ({
          id: a.id,
          name: a.name,
          balance: 0, // balance is computed from transactions
          currency: a.currency,
          type: a.type,
        })),
      };
    },
    {
      params: t.Object({ userId: t.String() }),
      detail: { tags: ["FINA Integration"], summary: "List user accounts for FINA" },
    }
  )

  // ─── User goals ────────────────────────────────────────────────────
  .get(
    "/users/:userId/goals",
    async ({ params: _params }) => {
      // Goals table not yet implemented — return empty list
      return { goals: [] };
    },
    {
      params: t.Object({ userId: t.String() }),
      detail: { tags: ["FINA Integration"], summary: "List user goals for FINA" },
    }
  )

  // ─── Transactions list ────────────────────────────────────────────
  .get(
    "/users/:userId/transactions",
    async ({ params, query }) => {
      const limit = query.limit ?? 200;
      const rows = await db
        .select({
          id: transactions.id,
          amount: transactions.amount,
          type: transactions.type,
          currency: transactions.currency,
          description: transactions.description,
          categoryId: transactions.categoryId,
          occurred_at: transactions.occurredAt,
        })
        .from(transactions)
        .where(eq(transactions.userId, params.userId))
        .orderBy(desc(transactions.occurredAt))
        .limit(limit);

      // Join category name
      const catIds = [...new Set(rows.map((r) => r.categoryId).filter(Boolean))] as string[];
      const catRows = catIds.length
        ? await db.select().from(categories).where(sql`${categories.id} IN (${sql.join(catIds.map(id => sql`${id}`), sql`, `)})`)
        : [];
      const catMap = new Map(catRows.map((c) => [c.id, c.name]));

      return {
        transactions: rows.map((r) => ({
          id: r.id,
          amount: Number(r.amount),
          type: r.type,
          currency: r.currency,
          description: r.description,
          category: r.categoryId ? catMap.get(r.categoryId) ?? null : null,
          category_id: r.categoryId,
          occurred_at: r.occurred_at,
        })),
      };
    },
    {
      params: t.Object({ userId: t.String() }),
      query: t.Object({ limit: t.Optional(t.Number({ minimum: 1, maximum: 1000 })) }),
      detail: { tags: ["FINA Integration"], summary: "List transactions for FINA" },
    }
  )

  // ─── Aggregated summary (income + spending by category) ───────────
  // Returns pre-computed fields so the LLM doesn't need to do arithmetic
  .get(
    "/users/:userId/summary",
    async ({ params, query }) => {
      const userId = params.userId;
      const period = query.period ?? "month";

      // ── Build date range from period ──────────────────────────
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      const now = new Date();

      if (period === "month") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      } else if (period === "year") {
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      } else if (/^\d{4}-\d{2}$/.test(period)) {
        const [y, m] = period.split("-").map(Number) as [number, number];
        startDate = new Date(y, m - 1, 1);
        endDate = new Date(y, m, 0, 23, 59, 59, 999);
      }
      // period === "all" → no filter

      // Get user's account for currency + role
      const [account] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, userId))
        .limit(1);
      const currency = account?.currency ?? "VND";
      const accountId = account?.id ?? null;

      // Build query conditions
      const conditions = [eq(transactions.userId, userId)];
      if (startDate) conditions.push(sql`${transactions.occurredAt} >= ${startDate}`);
      if (endDate) conditions.push(sql`${transactions.occurredAt} <= ${endDate}`);

      // Get filtered transactions
      const allTx = await db
        .select()
        .from(transactions)
        .where(and(...conditions))
        .orderBy(desc(transactions.occurredAt));

      // Get categories for name lookup
      const allCats = await db.select().from(categories);
      const catMap = new Map(allCats.map((c) => [c.id, c.name]));

      // ── Compute aggregates ────────────────────────────────────
      let income = 0;
      let totalSpent = 0;
      const spendingByCategory: Record<string, number> = {};

      for (const tx of allTx) {
        const amount = Number(tx.amount);
        if (tx.type === "INCOME") {
          income += amount;
        } else {
          totalSpent += amount;
          const catName = tx.categoryId ? catMap.get(tx.categoryId) ?? "Uncategorized" : "Uncategorized";
          spendingByCategory[catName] = (spendingByCategory[catName] ?? 0) + amount;
        }
      }

      const spending = Object.entries(spendingByCategory).map(([category_name, spent]) => ({
        category_name,
        spent,
      }));

      // ── Needs vs Wants classification ─────────────────────────
      const NEEDS_CATEGORIES = new Set(["food", "grocery", "bill", "rent", "transport", "healthcare", "insurance"]);
      let needsTotal = 0;
      let wantsTotal = 0;
      for (const [catName, spent] of Object.entries(spendingByCategory)) {
        if (NEEDS_CATEGORIES.has(catName.toLowerCase())) {
          needsTotal += spent;
        } else {
          wantsTotal += spent;
        }
      }

      // ── Top category ──────────────────────────────────────────
      let topCategory = "None";
      let topCategorySpent = 0;
      for (const [catName, spent] of Object.entries(spendingByCategory)) {
        if (spent > topCategorySpent) {
          topCategorySpent = spent;
          topCategory = catName;
        }
      }
      const topCategoryPct = income > 0 ? Math.round((topCategorySpent / income) * 1000) / 10 : 0;

      // ── Budget rule (use user preferences or default 50/30/20) ──
      const [budgetPref] = await db
        .select()
        .from(budgetPreferences)
        .where(eq(budgetPreferences.userId, userId))
        .limit(1);
      const needsPct = (budgetPref?.needsPct ?? 50) / 100;
      const wantsPct = (budgetPref?.wantsPct ?? 30) / 100;
      const savingsPct = (budgetPref?.savingsPct ?? 20) / 100;
      const needsLimit = Math.round(income * needsPct);
      const wantsLimit = Math.round(income * wantsPct);
      const savingsTarget = Math.round(income * savingsPct);

      // ── Over-budget categories (exceeding 30% of income) ──────
      const overBudgetCategories: { category: string; spent: number; pct: number }[] = [];
      if (income > 0) {
        for (const [catName, spent] of Object.entries(spendingByCategory)) {
          const pct = Math.round((spent / income) * 1000) / 10;
          if (pct > 30) {
            overBudgetCategories.push({ category: catName, spent, pct });
          }
        }
      }

      // ── Check actual budgets from DB ──────────────────────────
      let budgetStatus: { categoryName: string; limit: number; spent: number; pct: number }[] = [];
      if (accountId) {
        const userBudgets = await db
          .select()
          .from(budgets)
          .where(eq(budgets.accountId, accountId));

        budgetStatus = userBudgets.map((b) => {
          const catName = b.categoryId ? catMap.get(b.categoryId) ?? "All" : "All";
          const spent = b.categoryId
            ? (spendingByCategory[catName] ?? 0)
            : totalSpent;
          const limit = Number(b.amountLimit);
          return {
            categoryName: catName,
            limit,
            spent,
            pct: limit > 0 ? Math.round((spent / limit) * 1000) / 10 : 0,
          };
        });
      }

      // ── Surplus & savings rate ────────────────────────────────
      const surplus = income - totalSpent;
      const savingsRatePct = income > 0 ? Math.round((surplus / income) * 1000) / 10 : 0;

      // ── Per-category budgets ─────────────────────────────────
      const userCatBudgets = await db
        .select()
        .from(categoryBudgets)
        .where(eq(categoryBudgets.userId, userId));

      const categoryBudgetStatus = userCatBudgets.map((cb) => {
        const catName = catMap.get(cb.categoryId) ?? "Unknown";
        const spent = spendingByCategory[catName] ?? 0;
        const limit = Number(cb.monthlyLimit);
        return {
          categoryId: cb.categoryId,
          categoryName: catName,
          monthlyLimit: limit,
          spent,
          pct: limit > 0 ? Math.round((spent / limit) * 1000) / 10 : 0,
        };
      });

      // ── Recent history (last 50) ──────────────────────────────
      const history = allTx.slice(0, 50).map((tx) => ({
        id: tx.id,
        amount: Number(tx.amount),
        type: tx.type,
        occurred_at: tx.occurredAt,
        category: tx.categoryId ? catMap.get(tx.categoryId) ?? null : null,
      }));

      return {
        period,
        currency,
        income,
        spending,
        computed: {
          total_spent: totalSpent,
          surplus,
          savings_rate_pct: savingsRatePct,
          top_category: topCategory,
          top_category_spent: topCategorySpent,
          top_category_pct: topCategoryPct,
          over_budget_categories: overBudgetCategories,
          needs_total: needsTotal,
          wants_total: wantsTotal,
          budget_50_30_20: {
            needs_limit: needsLimit,
            wants_limit: wantsLimit,
            savings_target: savingsTarget,
          },
          budget_status: budgetStatus,
          category_budget_status: categoryBudgetStatus,
          has_category_budgets: userCatBudgets.length > 0,
        },
        history,
      };
    },
    {
      params: t.Object({ userId: t.String() }),
      query: t.Object({
        period: t.Optional(t.String()),
      }),
      detail: { tags: ["FINA Integration"], summary: "Get financial summary for FINA (supports ?period=month|year|all|YYYY-MM)" },
    }
  )

  // ─── Daily spending breakdown (for LSTM training) ─────────────────
  .get(
    "/users/:userId/spending/daily",
    async ({ params }) => {
      const allTx = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, params.userId),
            eq(transactions.type, "EXPENSE")
          )
        )
        .orderBy(desc(transactions.occurredAt));

      const allCats = await db.select().from(categories);
      const catMap = new Map(allCats.map((c) => [c.id, c.name]));

      const rows = allTx.map((tx) => ({
        day: tx.occurredAt.toISOString().split("T")[0],
        category: tx.categoryId ? catMap.get(tx.categoryId) ?? "Uncategorized" : "Uncategorized",
        amount: Number(tx.amount),
      }));

      return { rows };
    },
    {
      params: t.Object({ userId: t.String() }),
      detail: { tags: ["FINA Integration"], summary: "Daily spending for LSTM training" },
    }
  )

  // ─── Monthly spending history (per-category, by month) ──────────────
  .get(
    "/users/:userId/spending/monthly-history",
    async ({ params, query }) => {
      const monthsBack = query.months ?? 3;
      const userId = params.userId;

      // Category lookup
      const allCats = await db.select().from(categories);
      const catMap = new Map(allCats.map((c) => [c.id, c.name]));

      // Date boundaries: start of (now - N months) up to start of current month
      const now = new Date();
      const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);

      const expenseTx = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.type, "EXPENSE"),
            sql`${transactions.occurredAt} >= ${startDate}`,
            sql`${transactions.occurredAt} < ${startOfCurrentMonth}`
          )
        )
        .orderBy(desc(transactions.occurredAt));

      // ── Build months map ────────────────────────────────────────
      const months: Record<string, Record<string, number>> = {};
      // ── Build recurring detection map ───────────────────────────
      const recurringMap = new Map<
        string, // "description|category"
        { description: string; category: string; amounts: number[]; monthSet: Set<string> }
      >();

      for (const tx of expenseTx) {
        const month = tx.occurredAt.toISOString().slice(0, 7); // "YYYY-MM"
        const catName = tx.categoryId ? catMap.get(tx.categoryId) ?? "Uncategorized" : "Uncategorized";
        const amount = Number(tx.amount);

        // Per-category monthly totals
        if (!months[month]) months[month] = {};
        months[month][catName] = (months[month][catName] ?? 0) + amount;

        // Recurring detection
        const desc = (tx.description ?? "").trim();
        if (desc) {
          const key = `${desc.toLowerCase()}|${catName.toLowerCase()}`;
          if (!recurringMap.has(key)) {
            recurringMap.set(key, { description: desc, category: catName, amounts: [], monthSet: new Set() });
          }
          const entry = recurringMap.get(key)!;
          entry.amounts.push(amount);
          entry.monthSet.add(month);
        }
      }

      // ── Filter recurring: 2+ distinct months, max/min amount within 20% ──
      const recurring: { description: string; category: string; amount: number; occurrences: number }[] = [];
      for (const entry of recurringMap.values()) {
        if (entry.monthSet.size < 2) continue;
        const minAmt = Math.min(...entry.amounts);
        const maxAmt = Math.max(...entry.amounts);
        if (minAmt > 0 && maxAmt / minAmt > 1.2) continue;
        const avg = Math.round(entry.amounts.reduce((s, a) => s + a, 0) / entry.amounts.length);
        recurring.push({
          description: entry.description,
          category: entry.category,
          amount: avg,
          occurrences: entry.monthSet.size,
        });
      }
      recurring.sort((a, b) => b.amount - a.amount);

      return { months, recurring };
    },
    {
      params: t.Object({ userId: t.String() }),
      query: t.Object({
        months: t.Optional(t.Number({ minimum: 1, maximum: 24 })),
      }),
      detail: { tags: ["FINA Integration"], summary: "Monthly spending history with recurring detection" },
    }
  )

  // ─── All categories ───────────────────────────────────────────────
  .get(
    "/categories",
    async () => {
      const allCats = await db.select().from(categories);
      return {
        categories: allCats.map((c) => ({ id: c.id, name: c.name, type: c.type })),
      };
    },
    {
      detail: { tags: ["FINA Integration"], summary: "List all categories for FINA" },
    }
  )

  // ─── Callback: FINA pushes categorization result ──────────────────
  .post(
    "/callbacks/categorized",
    async ({ body, set }) => {
      const { transaction_id, category, confidence } = body;

      // Find category by name
      const allCats = await db.select().from(categories);
      const match = allCats.find(
        (c) => c.name.toLowerCase() === category.toLowerCase()
      );

      if (!match) {
        set.status = 400;
        return { success: false, message: `Category "${category}" not found` };
      }

      // Update transaction's categoryId
      await db
        .update(transactions)
        .set({ categoryId: match.id })
        .where(eq(transactions.id, transaction_id));

      return {
        success: true,
        transaction_id,
        category_id: match.id,
        category_name: match.name,
        confidence,
      };
    },
    {
      body: t.Object({
        transaction_id: t.String(),
        category: t.String(),
        confidence: t.Number({ minimum: 0, maximum: 1 }),
      }),
      detail: { tags: ["FINA Callbacks"], summary: "Receive categorization result from FINA" },
    }
  )

  // ─── Callback: FINA pushes forecast result ────────────────────────
  .post(
    "/callbacks/forecast/:userId",
    async ({ params, body }) => {
      const { weekly, monthly, confidence, source } = body;

      // Cache forecast for dashboard use
      forecastCache.set(params.userId, {
        weekly,
        monthly,
        confidence,
        source,
        cachedAt: new Date(),
      });

      return { success: true, userId: params.userId, cachedAt: new Date().toISOString() };
    },
    {
      params: t.Object({ userId: t.String() }),
      body: t.Object({
        weekly: t.Any(),
        monthly: t.Any(),
        confidence: t.Number(),
        source: t.String(),
      }),
      detail: { tags: ["FINA Callbacks"], summary: "Receive forecast result from FINA" },
    }
  )

  // ─── Read cached forecast ─────────────────────────────────────────
  .get(
    "/forecast/:userId",
    async ({ params, set }) => {
      const cached = forecastCache.get(params.userId);
      if (!cached) {
        set.status = 404;
        return { message: "No forecast available. Trigger one via FINA first." };
      }
      return cached;
    },
    {
      params: t.Object({ userId: t.String() }),
      detail: { tags: ["FINA Integration"], summary: "Get cached forecast for user" },
    }
  )

  // ─── Budget preferences (needs/wants/savings split) ──────────────────
  .get(
    "/users/:userId/budget-preferences",
    async ({ params }) => {
      const [row] = await db
        .select()
        .from(budgetPreferences)
        .where(eq(budgetPreferences.userId, params.userId))
        .limit(1);

      if (!row) return null;

      return {
        needs_pct: row.needsPct,
        wants_pct: row.wantsPct,
        savings_pct: row.savingsPct,
      };
    },
    {
      params: t.Object({ userId: t.String() }),
      detail: { tags: ["FINA Integration"], summary: "Get budget preferences (needs/wants/savings split)" },
    }
  )

  // ─── Budget preferences: POST (upsert) ─────────────────────────────
  .post(
    "/users/:userId/budget-preferences",
    async ({ params, body }) => {
      const userId = params.userId;

      await db
        .insert(budgetPreferences)
        .values({
          id: crypto.randomUUID(),
          userId,
          needsPct: body.needs_pct,
          wantsPct: body.wants_pct,
          savingsPct: body.savings_pct,
        })
        .onDuplicateKeyUpdate({
          set: {
            needsPct: body.needs_pct,
            wantsPct: body.wants_pct,
            savingsPct: body.savings_pct,
            updatedAt: new Date(),
          },
        });

      return {
        success: true,
        needs_pct: body.needs_pct,
        wants_pct: body.wants_pct,
        savings_pct: body.savings_pct,
      };
    },
    {
      params: t.Object({ userId: t.String() }),
      body: t.Object({
        needs_pct: t.Number({ minimum: 0, maximum: 100 }),
        wants_pct: t.Number({ minimum: 0, maximum: 100 }),
        savings_pct: t.Number({ minimum: 0, maximum: 100 }),
      }),
      detail: { tags: ["FINA Integration"], summary: "Create/update budget preferences" },
    }
  )

  // ─── Per-category budgets: GET ──────────────────────────────────────
  .get(
    "/users/:userId/category-budgets",
    async ({ params }) => {
      const rows = await db
        .select({
          id: categoryBudgets.id,
          categoryId: categoryBudgets.categoryId,
          monthlyLimit: categoryBudgets.monthlyLimit,
        })
        .from(categoryBudgets)
        .where(eq(categoryBudgets.userId, params.userId));

      // Join category names
      const catIds = rows.map((r) => r.categoryId).filter(Boolean) as string[];
      const catRows = catIds.length
        ? await db.select().from(categories).where(sql`${categories.id} IN (${sql.join(catIds.map(id => sql`${id}`), sql`, `)})`)
        : [];
      const catMap = new Map(catRows.map((c) => [c.id, c.name]));

      return {
        budgets: rows.map((r) => ({
          categoryId: r.categoryId,
          categoryName: catMap.get(r.categoryId) ?? null,
          monthlyLimit: Number(r.monthlyLimit),
        })),
      };
    },
    {
      params: t.Object({ userId: t.String() }),
      detail: { tags: ["FINA Integration"], summary: "Get per-category budgets for user" },
    }
  )

  // ─── Per-category budgets: POST (upsert) ────────────────────────────
  .post(
    "/users/:userId/category-budgets",
    async ({ params, body }) => {
      const userId = params.userId;
      const results: { categoryId: string; monthlyLimit: number }[] = [];

      for (const item of body.budgets) {
        await db
          .insert(categoryBudgets)
          .values({
            id: crypto.randomUUID(),
            userId,
            categoryId: item.categoryId,
            monthlyLimit: String(item.monthlyLimit),
          })
          .onDuplicateKeyUpdate({
            set: { monthlyLimit: String(item.monthlyLimit), updatedAt: new Date() },
          });
        results.push({ categoryId: item.categoryId, monthlyLimit: item.monthlyLimit });
      }

      return { success: true, budgets: results };
    },
    {
      params: t.Object({ userId: t.String() }),
      body: t.Object({
        budgets: t.Array(
          t.Object({
            categoryId: t.String(),
            monthlyLimit: t.Number({ minimum: 0 }),
          })
        ),
      }),
      detail: { tags: ["FINA Integration"], summary: "Create/update per-category budgets" },
    }
  )

  ;

// ═══════════════════════════════════════════════════════════════════
// FINA Chat Proxy — frontend calls this instead of Gemini RAG
// Separate Elysia instance with auth guard
// ═══════════════════════════════════════════════════════════════════

export const finaChatController = new Elysia({ prefix: "/api/fina" })
  .guard(authGuardConfig)
  // Attach a guaranteed userId (validated by the guard) so Drizzle never receives undefined
  .derive(resolveUserId)

  // ─── Chat via FINA Brain ──────────────────────────────────────────
  .post(
    "/chat",
    async ({ body, set, userId }) => {
      // userId comes from JWT via resolveUserId; guard ensures it exists
      const t0 = performance.now();

      // Get user profile for role/currency
      let role = "Student";
      try {
        const [account] = await db
          .select()
          .from(accounts)
          .where(eq(accounts.userId, userId))
          .limit(1);
        role = account?.role ?? "Student";
      } catch (dbErr) {
        console.error(`[FINA Chat] DB error fetching account:`, dbErr);
      }

      try {
        const finaResp = await fina.chat(userId, role, body.prompt, "Standard", body.history ?? []);
        const latencyMs = Math.round(performance.now() - t0);
        const replyText = finaResp.response ?? "";

        // ── Execute action based on user prompt ─────────────────────
        let actionResult: ActionResult | null = null;
        try {
          actionResult = await executeFromPrompt(body.prompt, userId);
          if (actionResult) {
            console.log(`[FINA Chat] Action executed:`, JSON.stringify(actionResult));
          }
        } catch (actionErr) {
          console.error(`[FINA Chat] Action execution error:`, actionErr);
        }

        // ── Log to insights DB ──────────────────────────────────────
        let logRow;
        try {
          logRow = await insertChatLog({
            accountId: userId,
            userQuery: body.prompt,
            aiResponse: replyText,
            modelName: "fina-brain",
            latencyMs,
            contextSnapshot: { source: "fina", intent: finaResp.intent ?? null },
            action: actionResult ?? undefined,
          });
        } catch (logErr) {
          console.error(`[FINA Chat] Log insert error:`, logErr);
          return {
            response: replyText,
            action: actionResult,
            log: { id: 0, account_id: userId, user_query: body.prompt, ai_response: replyText, context_snapshot: null, action: actionResult, model_name: "fina-brain", latency_ms: latencyMs, prompt_tokens: null, response_tokens: null, request_id: crypto.randomUUID(), feedback: null, timestamp: new Date().toISOString() },
            request_id: crypto.randomUUID(),
          };
        }

        return {
          response: replyText,
          action: actionResult,
          log: logRow,
          request_id: logRow.request_id,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "FINA unreachable";
        console.error(`[FINA Chat] FINA error:`, err);
        set.status = 502;
        return { message: `FINA Brain error: ${msg}` };
      }
    },
    {
      body: t.Object({
        prompt: t.String({ minLength: 1 }),
        displayCurrency: t.Optional(t.String()),
        history: t.Optional(t.Array(t.Object({
          role: t.String(),
          content: t.String(),
        }))),
      }),
      detail: { tags: ["FINA Chat"], summary: "Chat via FINA Brain (proxied)" },
    }
  )

  // ─── Chat logs (read from insights DB) ────────────────────────────
  .get(
    "/logs",
    async ({ query, userId }) => {
      const accountId = query.accountId ?? userId ?? "";
      const limit = query.limit ?? 50;
      const rows = await listChatLogs(accountId, limit);
      return rows;
    },
    {
      query: t.Object({
        accountId: t.Optional(t.String()),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 500 })),
      }),
      detail: { tags: ["FINA Chat"], summary: "List chat logs" },
    }
  )

  // ─── Feedback on chat logs ────────────────────────────────────────
  .patch(
    "/logs/:logId/feedback",
    async ({ params, body, set }) => {
      const feedbackVal = body.feedback === 0 ? null : body.feedback;
      const updated = await updateChatLogFeedback(Number(params.logId), feedbackVal);
      if (!updated) {
        set.status = 404;
        return { message: "Log not found" };
      }
      return updated;
    },
    {
      params: t.Object({ logId: t.String() }),
      body: t.Object({ feedback: t.Number({ minimum: -1, maximum: 1 }) }),
      detail: { tags: ["FINA Chat"], summary: "Submit feedback on chat response" },
    }
  )

  // ─── Dashboard insights + predictions from FINA ─────────────────────
  .get(
    "/dashboard",
    async ({ userId, set }) => {
      // Get user role for FINA
      let role = "Student";
      try {
        const [account] = await db
          .select()
          .from(accounts)
          .where(eq(accounts.userId, userId))
          .limit(1);
        role = account?.role ?? "Student";
      } catch {
        // continue with default
      }

      try {
        const data = await fina.dashboard(userId, role);
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "FINA unreachable";
        console.error(`[FINA Dashboard] error:`, err);
        set.status = 502;
        return { message: `FINA Brain error: ${msg}` };
      }
    },
    {
      detail: { tags: ["FINA Chat"], summary: "Get dashboard insights + predictions from FINA" },
    }
  );


// ═══════════════════════════════════════════════════════════════════
// Insights DB helpers (chat_logs in the insights database)
// ═══════════════════════════════════════════════════════════════════

const insightsPool = createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: process.env.INSIGHTS_DATABASE ?? "insights",
  waitForConnections: true,
  connectionLimit: 5,
});

type ChatLogRow = {
  id: number;
  account_id: string;
  user_query: string | null;
  ai_response: string | null;
  context_snapshot: unknown;
  action: unknown;
  model_name: string | null;
  latency_ms: number | null;
  prompt_tokens: number | null;
  response_tokens: number | null;
  request_id: string | null;
  feedback: number | null;
  timestamp: string | null;
};

async function insertChatLog(data: {
  accountId: string;
  userQuery: string;
  aiResponse: string;
  modelName: string;
  latencyMs: number;
  contextSnapshot?: unknown;
  action?: unknown;
  promptTokens?: number;
  responseTokens?: number;
}): Promise<ChatLogRow> {
  const requestId = crypto.randomUUID();
  const conn = await insightsPool.getConnection();
  try {
    const [result] = await conn.execute(
      `INSERT INTO chat_logs
       (account_id, user_query, ai_response, context_snapshot, action,
        model_name, latency_ms, prompt_tokens, response_tokens, request_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.accountId,
        data.userQuery,
        data.aiResponse,
        data.contextSnapshot ? JSON.stringify(data.contextSnapshot) : null,
        data.action ? JSON.stringify(data.action) : null,
        data.modelName,
        data.latencyMs,
        data.promptTokens ?? null,
        data.responseTokens ?? null,
        requestId,
      ]
    );
    const insertId = (result as { insertId: number }).insertId;
    const [rows] = await conn.execute(
      `SELECT id, account_id, user_query, ai_response, context_snapshot,
              action, model_name, latency_ms, prompt_tokens, response_tokens,
              request_id, feedback, timestamp
       FROM chat_logs WHERE id = ?`,
      [insertId]
    );
    return parseChatLogRow((rows as unknown[])[0]);
  } finally {
    conn.release();
  }
}

async function listChatLogs(accountId: string, limit: number): Promise<ChatLogRow[]> {
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 500);
  const [rows] = await insightsPool.execute(
    `SELECT id, account_id, user_query, ai_response, context_snapshot,
            action, model_name, latency_ms, prompt_tokens, response_tokens,
            request_id, feedback, timestamp
     FROM chat_logs WHERE account_id = ? ORDER BY timestamp DESC LIMIT ${safeLimit}`,
    [accountId]
  );
  return (rows as unknown[]).map(parseChatLogRow);
}

async function updateChatLogFeedback(logId: number, feedback: number | null): Promise<ChatLogRow | null> {
  const conn = await insightsPool.getConnection();
  try {
    await conn.execute("UPDATE chat_logs SET feedback = ? WHERE id = ?", [feedback, logId]);
    const [rows] = await conn.execute(
      `SELECT id, account_id, user_query, ai_response, context_snapshot,
              action, model_name, latency_ms, prompt_tokens, response_tokens,
              request_id, feedback, timestamp
       FROM chat_logs WHERE id = ?`,
      [logId]
    );
    const arr = rows as unknown[];
    return arr.length ? parseChatLogRow(arr[0]) : null;
  } finally {
    conn.release();
  }
}

function parseChatLogRow(row: unknown): ChatLogRow {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as number,
    account_id: r.account_id as string,
    user_query: r.user_query as string | null,
    ai_response: r.ai_response as string | null,
    context_snapshot: typeof r.context_snapshot === "string" ? JSON.parse(r.context_snapshot) : r.context_snapshot,
    action: typeof r.action === "string" ? JSON.parse(r.action) : r.action,
    model_name: r.model_name as string | null,
    latency_ms: r.latency_ms as number | null,
    prompt_tokens: r.prompt_tokens as number | null,
    response_tokens: r.response_tokens as number | null,
    request_id: r.request_id as string | null,
    feedback: r.feedback as number | null,
    timestamp: r.timestamp ? String(r.timestamp) : null,
  };
}
