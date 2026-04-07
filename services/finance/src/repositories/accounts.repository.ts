import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { accounts } from "../schemas/accounts.schema";
import type { InferSelectModel } from "drizzle-orm";

export type Account = InferSelectModel<typeof accounts>;
export type AccountInput = {
  userId: string;
  name: string;
  type?: Account["type"];
  currency?: Account["currency"];
  role?: Account["role"];
  frictionLevel?: Account["frictionLevel"];
};

export const listAccounts = async (userId?: string) => {
  if (userId) {
    return db.select().from(accounts).where(eq(accounts.userId, userId));
  }
  return db.select().from(accounts);
};

export const getAccount = async (id: string) => {
  const [row] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  return row ?? null;
};

export const createAccount = async (data: AccountInput) => {
  const record: Account = {
    id: randomUUID(),
    createdAt: new Date(),
    userId: data.userId,
    name: data.name,
    currency: data.currency ?? "VND",
    type: data.type ?? "CASH",
    role: data.role ?? "Student",
    frictionLevel: data.frictionLevel ?? "LOW",
  };

  await db.insert(accounts).values(record);
  return record;
};

export const updateAccount = async (id: string, data: Partial<AccountInput>) => {
  const payload: Partial<Account> = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.userId !== undefined) payload.userId = data.userId;
  if (data.type !== undefined) payload.type = data.type;
  if (data.currency !== undefined) payload.currency = data.currency;
  if (data.role !== undefined) payload.role = data.role;
  if (data.frictionLevel !== undefined) payload.frictionLevel = data.frictionLevel;

  await db
    .update(accounts)
    .set(payload)
    .where(eq(accounts.id, id));
  return getAccount(id);
};

export const deleteAccount = async (id: string) => {
  const record = await getAccount(id);
  if (!record) return null;
  await db.delete(accounts).where(eq(accounts.id, id));
  return record;
};
