import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { categories } from "../schemas/categories.schema";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export type Category = InferSelectModel<typeof categories>;
export type NewCategory = Omit<InferInsertModel<typeof categories>, "id" | "createdAt">;

const DEFAULT_CATEGORIES: { name: string; icon: string; type: "EXPENSE" | "INCOME" }[] = [
  { name: "Food", icon: "🍔", type: "EXPENSE" },
  { name: "Shopping", icon: "🛍️", type: "EXPENSE" },
  { name: "Bill", icon: "🧾", type: "EXPENSE" },
  { name: "Grocery", icon: "🛒", type: "EXPENSE" },
  { name: "Other", icon: "📦", type: "EXPENSE" },
  { name: "Uncategorized", icon: "❓", type: "EXPENSE" },
];

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

export const seedDefaultCategories = async (accountId: string) => {
  const records: Category[] = DEFAULT_CATEGORIES.map((cat) => ({
    id: randomUUID(),
    accountId,
    name: cat.name,
    icon: cat.icon,
    type: cat.type,
    createdAt: new Date(),
  }));
  await db.insert(categories).values(records);
  return records;
};

export const getUncategorized = async (accountId: string) => {
  const [row] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.accountId, accountId), eq(categories.name, "Uncategorized")))
    .limit(1);
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
