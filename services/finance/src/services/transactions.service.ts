import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  updateTransaction,
} from "../repositories/transactions.repository";
import type { TransactionInput } from "../repositories/transactions.repository";
import { listAccounts } from "../repositories/accounts.repository";
import { getUncategorized } from "../repositories/categories.repository";

const resolveDefaultCategory = async (userId: string): Promise<string | null> => {
  const accounts = await listAccounts(userId);
  for (const account of accounts) {
    const uncat = await getUncategorized(account.id);
    if (uncat) return uncat.id;
  }
  return null;
};

export const TransactionsService = {
  list: (userId?: string) => listTransactions(userId),
  get: (id: string) => getTransaction(id),
  create: async (data: TransactionInput) => {
    if (!data.categoryId && data.type !== "INCOME") {
      data.categoryId = await resolveDefaultCategory(data.userId);
    }
    return createTransaction(data);
  },
  update: (id: string, data: Partial<TransactionInput>) => updateTransaction(id, data),
  delete: (id: string) => deleteTransaction(id),
};
