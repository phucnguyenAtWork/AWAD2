import {
  createAccount,
  deleteAccount,
  getAccount,
  listAccounts,
  updateAccount,
} from "../repositories/accounts.repository";
import type { AccountInput } from "../repositories/accounts.repository";

export const AccountsService = {
  list: (userId?: string) => listAccounts(userId),
  get: (id: string) => getAccount(id),
  create: (data: AccountInput) => createAccount(data),
  update: (id: string, data: Partial<AccountInput>) => updateAccount(id, data),
  delete: (id: string) => deleteAccount(id),
};
