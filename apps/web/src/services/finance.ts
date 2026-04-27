import type {
  BackendAccount,
  BackendBudget,
  BudgetInput,
  BackendCategory,
  NewCategory,
  BackendTransaction,
  TransactionInput,
  Account,
  AccountPayload,
  Budget,
  Category,
  Transaction,
} from './types';
import { request } from './http';

const FINANCE_BASE = (import.meta.env.VITE_FINANCE_API_URL ?? 'http://localhost:4001').replace(/\/+$/, '');

type RequestOptions = {
  onUnauthorized?: () => void;
  signal?: AbortSignal;
};

const toIso = (value: string): string =>
  new Date(value).toISOString();

const mapAccount = (raw: BackendAccount): Account => ({
  ...raw,
  createdAt: toIso(raw.createdAt),
});

const mapCategory = (raw: BackendCategory): Category => ({
  ...raw,
  createdAt: toIso(raw.createdAt),
});

const mapBudget = (raw: BackendBudget, accountName?: string, categoryName?: string): Budget => ({
  ...raw,
  amountLimit: Number(raw.amountLimit),
  amount_limit: Number(raw.amountLimit),
  alertThreshold: Number(raw.alertThreshold),
  alert_threshold: Number(raw.alertThreshold),
  startDate: toIso(raw.startDate),
  start_date: toIso(raw.startDate),
  endDate: toIso(raw.endDate),
  end_date: toIso(raw.endDate),
  createdAt: raw.createdAt ? toIso(raw.createdAt) : new Date().toISOString(),
  accountName,
  account_name: accountName,
  categoryName: categoryName ?? (raw.categoryId ? undefined : 'Overall'),
  category_name: categoryName ?? (raw.categoryId ? undefined : 'Overall'),
  spent: 0,
});

const mapTransaction = (
  raw: BackendTransaction,
  categoryName?: string,
): Transaction => ({
  id: raw.id,
  userId: raw.userId,
  type: raw.type,
  amount: Number(raw.amount),
  currency: raw.currency,
  description: raw.description ?? '',
  categoryId: raw.categoryId ?? null,
  categoryName: categoryName ?? 'Uncategorized',
  category_name: categoryName ?? 'Uncategorized',
  essential: raw.essential ?? false,
  tags: Array.isArray(raw.tags) ? raw.tags : [],
  occurredAt: toIso(raw.occurredAt),
  occurred_at: toIso(raw.occurredAt),
});

export type TransactionDraft = Omit<TransactionInput, 'amount' | 'occurredAt' | 'userId'> & {
  amount: number;
  occurredAt?: string;
  categoryId?: string | null;
  description?: string | null;
};

export type BudgetDraft = Omit<BudgetInput, 'amountLimit' | 'alertThreshold' | 'startDate' | 'endDate'> & {
  amountLimit: number;
  alertThreshold?: number;
  categoryId?: string | null;
  startDate: string;
  endDate: string;
};

export type CategoryDraft = Omit<NewCategory, 'createdAt'>;
export type BudgetPreferences = {
  needs_pct: number;
  wants_pct: number;
  savings_pct: number;
};

export const financeService = {
  async listAccounts(token: string, options: RequestOptions = {}): Promise<Account[]> {
    const data = await request<BackendAccount[]>(FINANCE_BASE, '/accounts', { token, ...options });
    return data.map(mapAccount);
  },

  async createAccount(token: string, payload: AccountPayload, options: RequestOptions = {}): Promise<Account> {
    const data = await request<BackendAccount, AccountPayload>(FINANCE_BASE, '/accounts', {
      method: 'POST',
      token,
      body: payload,
      ...options,
    });
    return mapAccount(data);
  },

  async updateAccount(token: string, id: string, payload: Partial<AccountPayload>, options: RequestOptions = {}): Promise<Account> {
    const data = await request<BackendAccount, Partial<AccountPayload>>(FINANCE_BASE, `/accounts/${id}`, {
      method: 'PATCH',
      token,
      body: payload,
      ...options,
    });
    return mapAccount(data);
  },

  async listCategories(token: string, accountId?: string, options: RequestOptions = {}): Promise<Category[]> {
    const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
    const data = await request<BackendCategory[]>(FINANCE_BASE, `/categories${query}`, { token, ...options });
    return data.map(mapCategory);
  },

  async createCategory(token: string, payload: CategoryDraft, options: RequestOptions = {}): Promise<Category> {
    const data = await request<BackendCategory, CategoryDraft>(FINANCE_BASE, '/categories', {
      method: 'POST',
      token,
      body: payload,
      ...options,
    });
    return mapCategory(data);
  },

  async listBudgets(token: string, options: RequestOptions = {}): Promise<Budget[]> {
    const [budgets, accounts, categories] = await Promise.all([
      request<BackendBudget[]>(FINANCE_BASE, '/budgets', { token, ...options }),
      this.listAccounts(token, options),
      this.listCategories(token, undefined, options),
    ]);
    const accountNames = new Map(accounts.map((acct) => [acct.id, acct.name]));
    const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
    return budgets.map((b) =>
      mapBudget(b, accountNames.get(b.accountId), b.categoryId ? categoryNames.get(b.categoryId) : undefined),
    );
  },

  async createBudget(token: string, payload: BudgetDraft, options: RequestOptions = {}): Promise<Budget> {
    const data = await request<BackendBudget, BudgetDraft>(FINANCE_BASE, '/budgets', {
      method: 'POST',
      token,
      body: payload,
      ...options,
    });
    return mapBudget(data);
  },

  async updateBudget(token: string, id: string, payload: Partial<BudgetDraft>, options: RequestOptions = {}): Promise<Budget> {
    const data = await request<BackendBudget, Partial<BudgetDraft>>(FINANCE_BASE, `/budgets/${id}`, {
      method: 'PATCH',
      token,
      body: payload,
      ...options,
    });
    return mapBudget(data);
  },

  async deleteBudget(token: string, id: string, options: RequestOptions = {}): Promise<{ success: boolean }> {
    return request(FINANCE_BASE, `/budgets/${id}`, {
      method: 'DELETE',
      token,
      ...options,
    });
  },

  async listTransactions(token: string, options: RequestOptions = {}): Promise<Transaction[]> {
    const [transactions, categories] = await Promise.all([
      request<BackendTransaction[]>(FINANCE_BASE, '/transactions', { token, ...options }),
      this.listCategories(token, undefined, options),
    ]);
    const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
    return transactions.map((tx) => mapTransaction(tx, tx.categoryId ? categoryNames.get(tx.categoryId) : undefined));
  },

  async createTransaction(token: string, payload: TransactionDraft, options: RequestOptions = {}): Promise<Transaction> {
    const data = await request<BackendTransaction, TransactionDraft>(FINANCE_BASE, '/transactions', {
      method: 'POST',
      token,
      body: payload,
      ...options,
    });
    return mapTransaction(data);
  },

  async updateTransaction(token: string, id: string, payload: Partial<TransactionDraft>, options: RequestOptions = {}): Promise<Transaction> {
    const data = await request<BackendTransaction, Partial<TransactionInput>>(FINANCE_BASE, `/transactions/${id}`, {
      method: 'PATCH',
      token,
      body: payload,
      ...options,
    });
    return mapTransaction(data);
  },

  async deleteTransaction(token: string, id: string, options: RequestOptions = {}): Promise<{ success: boolean }> {
    return request(FINANCE_BASE, `/transactions/${id}`, {
      method: 'DELETE',
      token,
      ...options,
    });
  },

  async getBudgetPreferences(token: string, userId: string, options: RequestOptions = {}): Promise<BudgetPreferences | null> {
    return request<BudgetPreferences | null>(FINANCE_BASE, `/api/fina/users/${encodeURIComponent(userId)}/budget-preferences`, {
      token,
      ...options,
    });
  },

  async saveBudgetPreferences(token: string, userId: string, payload: BudgetPreferences, options: RequestOptions = {}): Promise<BudgetPreferences> {
    return request<BudgetPreferences, BudgetPreferences>(FINANCE_BASE, `/api/fina/users/${encodeURIComponent(userId)}/budget-preferences`, {
      method: 'POST',
      token,
      body: payload,
      ...options,
    });
  },

};
