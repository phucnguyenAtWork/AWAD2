import { randomUUID } from "crypto";
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { transactions } from "../schemas/transactions.schema";
import type { InferSelectModel } from "drizzle-orm";

export type Transaction = InferSelectModel<typeof transactions>;
export type TransactionInput = {
  userId: string;
  type?: Transaction["type"];
  amount: Transaction["amount"] | number;
  currency?: Transaction["currency"];
  description?: Transaction["description"];
  categoryId?: Transaction["categoryId"];
  essential?: Transaction["essential"];
  tags?: Transaction["tags"];
  occurredAt?: Transaction["occurredAt"] | string;
};

export const listTransactions = async (userId?: string) => {
  if (userId) {
    return db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.occurredAt));
  }
  return db.select().from(transactions).orderBy(desc(transactions.occurredAt));
};

export const getTransaction = async (id: string) => {
  const [row] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  return row ?? null;
};

export const createTransaction = async (data: TransactionInput) => {
  const record: Transaction = {
    id: randomUUID(),
    type: data.type ?? "EXPENSE",
    currency: data.currency ?? "VND",
    essential: data.essential ?? false,
    occurredAt:
      data.occurredAt !== undefined
        ? data.occurredAt instanceof Date
          ? data.occurredAt
          : new Date(data.occurredAt)
        : new Date(),
    amount: data.amount !== undefined ? String(data.amount) : "0",
    userId: data.userId,
    description: data.description ?? null,
    categoryId: data.categoryId ?? null,
    tags: data.tags,
  };
  await db.insert(transactions).values(record);
  return record;
};

export const updateTransaction = async (id: string, data: Partial<TransactionInput>) => {
  const payload: Partial<Transaction> = {};
  if (data.userId !== undefined) payload.userId = data.userId;
  if (data.type !== undefined) payload.type = data.type;
  if (data.amount !== undefined) payload.amount = String(data.amount);
  if (data.currency !== undefined) payload.currency = data.currency;
  if (data.description !== undefined) payload.description = data.description ?? null;
  if (data.categoryId !== undefined) payload.categoryId = data.categoryId ?? null;
  if (data.essential !== undefined) payload.essential = data.essential;
  if (data.tags !== undefined) payload.tags = data.tags;
  if (data.occurredAt !== undefined) {
    payload.occurredAt =
      data.occurredAt instanceof Date ? data.occurredAt : new Date(data.occurredAt);
  }

  await db.update(transactions).set(payload).where(eq(transactions.id, id));
  return getTransaction(id);
};

export const deleteTransaction = async (id: string) => {
  const record = await getTransaction(id);
  if (!record) return null;
  await db.delete(transactions).where(eq(transactions.id, id));
  return record;
};
