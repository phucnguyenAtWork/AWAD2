import {
  createBudget,
  deleteBudget,
  getBudget,
  listBudgets,
  updateBudget,
} from "../repositories/budgets.repository";
import type { BudgetInput } from "../repositories/budgets.repository";

export const BudgetsService = {
  list: (accountId?: string) => listBudgets(accountId),
  get: (id: string) => getBudget(id),
  create: (data: BudgetInput) => createBudget(data),
  update: (id: string, data: Partial<BudgetInput>) => updateBudget(id, data),
  delete: (id: string) => deleteBudget(id),
};
