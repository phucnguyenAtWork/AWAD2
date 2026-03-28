import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  updateTransaction,
} from "../repositories/transactions.repository";
import type { TransactionInput } from "../repositories/transactions.repository";

export const TransactionsService = {
  list: (userId?: string) => listTransactions(userId),
  get: (id: string) => getTransaction(id),
  create: (data: TransactionInput) => createTransaction(data),
  update: (id: string, data: Partial<TransactionInput>) => updateTransaction(id, data),
  delete: (id: string) => deleteTransaction(id),
};
