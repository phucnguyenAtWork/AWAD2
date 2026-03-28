import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from "../repositories/categories.repository";
import type { NewCategory } from "../repositories/categories.repository";

export const CategoriesService = {
  list: (accountId?: string) => listCategories(accountId),
  get: (id: string) => getCategory(id),
  create: (data: NewCategory) => createCategory(data),
  update: (id: string, data: Partial<NewCategory>) => updateCategory(id, data),
  delete: (id: string) => deleteCategory(id),
};
