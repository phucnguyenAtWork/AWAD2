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
import { fina } from "../lib/fina-client";
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
  .get(
    "/users/:userId/summary",
    async ({ params }) => {
      const userId = params.userId;

      // Get user's account for currency
      const [account] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, userId))
        .limit(1);
      const currency = account?.currency ?? "VND";

      // Get all transactions
      const allTx = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, userId))
        .orderBy(desc(transactions.occurredAt));

      // Get categories for name lookup
      const allCats = await db.select().from(categories);
      const catMap = new Map(allCats.map((c) => [c.id, c.name]));

      // Compute aggregates
      let income = 0;
      let expense = 0;
      const spendingByCategory: Record<string, number> = {};

      for (const tx of allTx) {
        const amount = Number(tx.amount);
        if (tx.type === "INCOME") {
          income += amount;
        } else {
          expense += amount;
          const catName = tx.categoryId ? catMap.get(tx.categoryId) ?? "Uncategorized" : "Uncategorized";
          spendingByCategory[catName] = (spendingByCategory[catName] ?? 0) + amount;
        }
      }

      const spending = Object.entries(spendingByCategory).map(([category_name, spent]) => ({
        category_name,
        spent,
      }));

      // Recent history (last 50)
      const history = allTx.slice(0, 50).map((tx) => ({
        id: tx.id,
        amount: Number(tx.amount),
        type: tx.type,
        occurred_at: tx.occurredAt,
        category: tx.categoryId ? catMap.get(tx.categoryId) ?? null : null,
      }));

      return { currency, income, spending, history };
    },
    {
      params: t.Object({ userId: t.String() }),
      detail: { tags: ["FINA Integration"], summary: "Get financial summary for FINA" },
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
        // Continue with default role
      }

      try {
        const finaResp = await fina.chat(userId, role, body.prompt);
        const latencyMs = Math.round(performance.now() - t0);
        const replyText = finaResp.response ?? "";

        // Log to insights DB (same chat_logs table)
        let logRow;
        try {
          logRow = await insertChatLog({
            accountId: userId,
            userQuery: body.prompt,
            aiResponse: replyText,
            modelName: "fina-brain",
            latencyMs,
            contextSnapshot: { source: "fina", intent: finaResp.intent ?? null },
          });
        } catch (logErr) {
          console.error(`[FINA Chat] Log insert error:`, logErr);
          // Return response even if logging fails
          return {
            response: replyText,
            log: { id: 0, account_id: userId, user_query: body.prompt, ai_response: replyText, context_snapshot: null, action: null, model_name: "fina-brain", latency_ms: latencyMs, prompt_tokens: null, response_tokens: null, request_id: crypto.randomUUID(), feedback: null, timestamp: new Date().toISOString() },
            request_id: crypto.randomUUID(),
          };
        }

        return {
          response: replyText,
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
