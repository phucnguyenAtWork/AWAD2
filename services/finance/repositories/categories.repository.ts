import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { categories } from "../schemas/categories.schema";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export type Category = InferSelectModel<typeof categories>;
export type NewCategory = Omit<InferInsertModel<typeof categories>, "id" | "createdAt">;

export const listCategories = async (accountId?: string) => {
  if (accountId) {
    return db.select().from(categories).where(eq(categories.accountId, accountId));
  }
  return db.select().from(categories);
};

export const getCategory = async (id: string) => {
  const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return row ?? null;
};

export const createCategory = async (data: NewCategory) => {
  const record: Category = {
    id: randomUUID(),
    createdAt: new Date(),
    type: data.type ?? "EXPENSE",
    accountId: data.accountId ?? null,
    icon: data.icon ?? null,
    ...data,
  };
  await db.insert(categories).values(record);
  return record;
};

export const updateCategory = async (id: string, data: Partial<NewCategory>) => {
  await db.update(categories).set(data).where(eq(categories.id, id));
  return getCategory(id);
};

export const deleteCategory = async (id: string) => {
  const record = await getCategory(id);
  if (!record) return null;
  await db.delete(categories).where(eq(categories.id, id));
  return record;
};
