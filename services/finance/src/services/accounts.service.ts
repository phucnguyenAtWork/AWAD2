import {
  createAccount,
  deleteAccount,
  getAccount,
  listAccounts,
  updateAccount,
} from "../repositories/accounts.repository";
import type { AccountInput } from "../repositories/accounts.repository";
import { seedDefaultCategories } from "../repositories/categories.repository";

export const AccountsService = {
  list: (userId?: string) => listAccounts(userId),
  get: (id: string) => getAccount(id),
  create: async (data: AccountInput) => {
    const account = await createAccount(data);
    await seedDefaultCategories(account.id);
    return account;
  },
  update: (id: string, data: Partial<AccountInput>) => updateAccount(id, data),
  delete: (id: string) => deleteAccount(id),
};
