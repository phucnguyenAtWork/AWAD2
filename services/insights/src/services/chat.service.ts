import { ChatLogsRepository, type NewChatLog } from "../repositories/chatLogs.repository";
import { modelClient, type GeminiMessage } from "./modelClient";
import { env } from "../env";

type FinanceContext = {
  accounts: Array<{ id: string; name: string; type: string; currency: string }>;
  categories: Array<{ id: string; name: string; icon: string | null; type: string; accountId: string | null }>;
  transactions: Array<{ id: string; type: string; amount: string; description: string | null; categoryId: string | null; occurredAt: string; currency: string }>;
  budgets: Array<{ id: string; accountId: string; categoryId: string | null; amountLimit: string; period: string; startDate: string; endDate: string }>;
};

async function fetchFinanceContext(token: string): Promise<FinanceContext> {
  const base = env.financeApiUrl;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const results = await Promise.allSettled([
    fetch(`${base}/accounts`, { headers }),
    fetch(`${base}/categories`, { headers }),
    fetch(`${base}/transactions`, { headers }),
    fetch(`${base}/budgets`, { headers }),
  ]);

  const parseResult = async <T>(result: PromiseSettledResult<Response>, label: string): Promise<T[]> => {
    if (result.status === "rejected") {
      console.error(`[RAG] Failed to fetch ${label}:`, result.reason);
      return [];
    }
    if (!result.value.ok) {
      console.error(`[RAG] ${label} returned ${result.value.status}`);
      return [];
    }
    return (await result.value.json()) as T[];
  };

  return {
    accounts: await parseResult(results[0], "accounts"),
    categories: await parseResult(results[1], "categories"),
    transactions: await parseResult(results[2], "transactions"),
    budgets: await parseResult(results[3], "budgets"),
  };
}

function computeAnalytics(ctx: FinanceContext, currency: string) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let totalIncome = 0;
  let totalExpense = 0;
  let monthIncome = 0;
  let monthExpense = 0;
  const categorySpending = new Map<string, number>();
  const monthlySpending = new Map<string, { income: number; expense: number }>();

  for (const tx of ctx.transactions) {
    const amount = Number(tx.amount);
    const txDate = new Date(tx.occurredAt);
    const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, "0")}`;
    const isCurrentMonth = txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;

    if (!monthlySpending.has(monthKey)) monthlySpending.set(monthKey, { income: 0, expense: 0 });
    const month = monthlySpending.get(monthKey)!;

    if (tx.type === "INCOME") {
      totalIncome += amount;
      month.income += amount;
      if (isCurrentMonth) monthIncome += amount;
    } else {
      totalExpense += amount;
      month.expense += amount;
      if (isCurrentMonth) monthExpense += amount;

      const catName = ctx.categories.find((c) => c.id === tx.categoryId)?.name ?? "Uncategorized";
      categorySpending.set(catName, (categorySpending.get(catName) ?? 0) + amount);
    }
  }

  // Sort category spending descending
  const topCategories = [...categorySpending.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => `  - ${name}: ${amount.toLocaleString()} ${currency}`)
    .join("\n");

  // Monthly summary (last 3 months)
  const sortedMonths = [...monthlySpending.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 3)
    .map(([month, data]) => `  - ${month}: Income ${data.income.toLocaleString()} ${currency}, Expense ${data.expense.toLocaleString()} ${currency}, Net ${(data.income - data.expense).toLocaleString()} ${currency}`)
    .join("\n");

  return {
    totalIncome,
    totalExpense,
    netBalance: totalIncome - totalExpense,
    monthIncome,
    monthExpense,
    monthNet: monthIncome - monthExpense,
    topCategories,
    sortedMonths,
    transactionCount: ctx.transactions.length,
  };
}

function buildSystemPrompt(ctx: FinanceContext, displayCurrency?: string): string {
  // Use the display currency preference from the frontend, fallback to account currency
  const currency = displayCurrency || ctx.accounts[0]?.currency || "VND";
  const analytics = computeAnalytics(ctx, currency);

  const fmt = (n: number) => `${n.toLocaleString()} ${currency}`;

  const accountsList = ctx.accounts.map((a) => `  - "${a.name}" (id: ${a.id}, type: ${a.type}, currency: ${a.currency})`).join("\n");
  const categoriesList = ctx.categories.map((c) => `  - "${c.name}" (id: ${c.id}, type: ${c.type})`).join("\n");

  const recentTx = ctx.transactions.slice(0, 30).map((t) => {
    const catName = ctx.categories.find((c) => c.id === t.categoryId)?.name ?? "Uncategorized";
    return `  - ${t.type} ${fmt(Number(t.amount))} "${t.description ?? ""}" [${catName}] on ${t.occurredAt}`;
  }).join("\n");

  const budgetsList = ctx.budgets.map((b) => {
    const catName = b.categoryId ? ctx.categories.find((c) => c.id === b.categoryId)?.name ?? "Unknown" : "Overall";
    const accName = ctx.accounts.find((a) => a.id === b.accountId)?.name ?? "Unknown";
    return `  - ${accName} / ${catName}: limit ${fmt(Number(b.amountLimit))}, ${b.period}, ${b.startDate} → ${b.endDate}`;
  }).join("\n");

  return `You are a smart personal finance assistant. You have access to the user's real financial data.
IMPORTANT: Always respond in English regardless of the user's input language.
The user's currency is ${currency}. Always display monetary amounts in ${currency}.

═══ FINANCIAL SUMMARY ═══
Total Income: ${fmt(analytics.totalIncome)}
Total Expenses: ${fmt(analytics.totalExpense)}
Net Balance: ${fmt(analytics.netBalance)}
This Month Income: ${fmt(analytics.monthIncome)}
This Month Expenses: ${fmt(analytics.monthExpense)}
This Month Net: ${fmt(analytics.monthNet)}
Total Transactions: ${analytics.transactionCount}

═══ SPENDING BY CATEGORY ═══
${analytics.topCategories || "  (no spending data)"}

═══ MONTHLY TREND (last 3 months) ═══
${analytics.sortedMonths || "  (no data)"}

═══ ACCOUNTS ═══
${accountsList || "  (none)"}

═══ CATEGORIES ═══
${categoriesList || "  (none)"}

═══ RECENT TRANSACTIONS (last 30) ═══
${recentTx || "  (none)"}

═══ BUDGETS ═══
${budgetsList || "  (none)"}

═══ INSTRUCTIONS ═══
1. Always respond in English.
2. Always use ${currency} when displaying monetary amounts. Never use a different currency symbol or code.
3. You can answer questions about the user's spending, income, trends, budgets, and give financial advice based on their REAL data above.
4. When the user wants to LOG a transaction (e.g., "I spent 50k on coffee", "received 5M salary"), output an action block.
5. When the user wants to CREATE a budget (e.g., "budget 2M for food this month"), output an action block.
6. CRITICAL — Category matching: You MUST pick the best matching category from the CATEGORIES list above. NEVER use "Uncategorized" if a better match exists. Use semantic understanding:
   - Food/drink items (coffee, lunch, dinner, snacks, restaurants, groceries) → "Food" or "Grocery"
   - Utilities, rent, subscriptions → "Bill"
   - Clothes, electronics, online orders → "Shopping"
   - Only use "Uncategorized" as an absolute last resort when nothing fits.
7. Use the user's first account as default unless they specify otherwise.
8. Currency shorthand: "50k" = 50,000, "2M" = 2,000,000, "1tr" = 1,000,000. These amounts are in ${currency}.
9. Today's date is ${new Date().toISOString().slice(0, 10)}.
10. Be concise but helpful. If giving spending insights, reference actual numbers from the data.

═══ ACTION FORMAT ═══
When creating a transaction, include EXACTLY one block:

\`\`\`action
{"action":"create_transaction","data":{"type":"EXPENSE","amount":50000,"description":"Coffee","categoryId":"<actual-category-id-from-list>","occurredAt":"2026-03-29"}}
\`\`\`

For income, use "type":"INCOME" and omit categoryId.

When creating a budget:

\`\`\`action
{"action":"create_budget","data":{"accountId":"<actual-account-id>","categoryId":"<actual-category-id-or-null>","amountLimit":2000000,"period":"MONTHLY","startDate":"2026-03-01","endDate":"2026-03-31"}}
\`\`\`

IMPORTANT:
- Always use real IDs from the CATEGORIES and ACCOUNTS lists above. Never use placeholder strings like "<id>".
- Always pick the most appropriate categoryId for the transaction. "coffee" → Food category, "electricity" → Bill category, etc.
- Always include a friendly confirmation message alongside the action block.
- If you're unsure about any detail, ask the user to clarify before creating the action.`;
}

type ActionPayload =
  | { action: "create_transaction"; data: { type: string; amount: number; description: string; categoryId?: string | null; occurredAt?: string; essential?: boolean } }
  | { action: "create_budget"; data: { accountId: string; categoryId?: string | null; amountLimit: number; period?: string; startDate: string; endDate: string } };

function parseAction(text: string): ActionPayload | null {
  const match = text.match(/```action\s*([\s\S]*?)```/);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1].trim()) as ActionPayload;
  } catch {
    return null;
  }
}

async function executeAction(action: ActionPayload, token: string, ctx: FinanceContext, displayCurrency?: string): Promise<string> {
  const base = env.financeApiUrl;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const currency = displayCurrency || ctx.accounts[0]?.currency || "VND";

  if (action.action === "create_transaction") {
    const res = await fetch(`${base}/transactions`, {
      method: "POST",
      headers,
      body: JSON.stringify(action.data),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[RAG] Failed to create transaction:", err);
      return `Failed to create transaction: ${err}`;
    }
    const tx = (await res.json()) as { type: string; amount: string; description: string | null; categoryId: string | null };
    const catName = ctx.categories.find((c) => c.id === tx.categoryId)?.name ?? "Uncategorized";
    return `Transaction logged: ${tx.type} ${Number(tx.amount).toLocaleString()} ${currency} — "${tx.description}" [${catName}]`;
  }

  if (action.action === "create_budget") {
    const res = await fetch(`${base}/budgets`, {
      method: "POST",
      headers,
      body: JSON.stringify(action.data),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[RAG] Failed to create budget:", err);
      return `Failed to create budget: ${err}`;
    }
    const b = (await res.json()) as { categoryId: string | null; amountLimit: string; period: string };
    const catName = b.categoryId ? ctx.categories.find((c) => c.id === b.categoryId)?.name ?? "Unknown" : "Overall";
    return `Budget created: ${catName} — limit ${Number(b.amountLimit).toLocaleString()} ${currency} (${b.period})`;
  }

  return "Unknown action";
}

export type ChatInput = {
  userId: string;
  token: string;
  prompt: string;
  displayCurrency?: string;
};

export const ChatService = {
  async chat(input: ChatInput) {
    // 1. Fetch user's financial context (RAG)
    const ctx = await fetchFinanceContext(input.token);
    console.log(`[RAG] Context: ${ctx.accounts.length} accounts, ${ctx.categories.length} categories, ${ctx.transactions.length} transactions, ${ctx.budgets.length} budgets`);

    const systemPrompt = buildSystemPrompt(ctx, input.displayCurrency);

    // 2. Load recent chat history for conversation context
    const recentLogs = await ChatLogsRepository.listByAccount(input.userId, 10);
    const history: GeminiMessage[] = [];
    for (const log of recentLogs.reverse()) {
      if (log.userQuery) history.push({ role: "user", parts: [{ text: log.userQuery }] });
      if (log.aiResponse) history.push({ role: "model", parts: [{ text: log.aiResponse }] });
    }
    history.push({ role: "user", parts: [{ text: input.prompt }] });

    // 3. Call Gemini with system prompt (RAG context) + conversation history
    const response = await modelClient.chat({
      systemInstruction: systemPrompt,
      messages: history,
    });

    let aiText = response.text;

    // 4. Parse and execute any action from the AI response
    const action = parseAction(aiText);
    if (action) {
      console.log("[RAG] Detected action:", JSON.stringify(action));
      const actionResult = await executeAction(action, input.token, ctx, input.displayCurrency);
      // Clean the action block from the visible response
      aiText = aiText.replace(/```action[\s\S]*?```/g, "").trim();
      aiText = `${aiText}\n\n✅ ${actionResult}`;
    }

    // 5. Save chat log with context snapshot
    const log: NewChatLog = {
      accountId: input.userId,
      userQuery: input.prompt,
      aiResponse: aiText,
      contextSnapshot: {
        accountCount: ctx.accounts.length,
        categoryCount: ctx.categories.length,
        transactionCount: ctx.transactions.length,
        budgetCount: ctx.budgets.length,
        accounts: ctx.accounts.map((a) => a.name),
        categories: ctx.categories.map((c) => c.name),
      },
      timestamp: new Date(),
    };
    const saved = await ChatLogsRepository.create(log);

    return { response: aiText, log: saved };
  },

  list(accountId: string, limit?: number) {
    return ChatLogsRepository.listByAccount(accountId, limit ?? 100);
  },

  get(id: number) {
    return ChatLogsRepository.get(id);
  },

  delete(id: number) {
    return ChatLogsRepository.delete(id);
  },
};
