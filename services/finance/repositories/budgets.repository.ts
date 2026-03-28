import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { budgets } from "../schemas/budgets.schema";
import type { InferSelectModel } from "drizzle-orm";

export type Budget = InferSelectModel<typeof budgets>;
export type BudgetInput = {
  accountId: string;
  amountLimit: Budget["amountLimit"] | number;
  period?: Budget["period"];
  alertThreshold?: Budget["alertThreshold"] | number;
  startDate: Budget["startDate"] | string;
  endDate: Budget["endDate"] | string;
};

export const listBudgets = async (accountId?: string) => {
  if (accountId) {
    return db.select().from(budgets).where(eq(budgets.accountId, accountId));
  }
  return db.select().from(budgets);
};

export const getBudget = async (id: string) => {
  const [row] = await db.select().from(budgets).where(eq(budgets.id, id)).limit(1);
  return row ?? null;
};

export const createBudget = async (data: BudgetInput) => {
  const record: Budget = {
    id: randomUUID(),
    createdAt: new Date(),
    period: data.period ?? "MONTHLY",
    alertThreshold:
      data.alertThreshold !== undefined ? String(data.alertThreshold) : "0.80",
    amountLimit:
      data.amountLimit !== undefined ? String(data.amountLimit) : "0",
    startDate: data.startDate instanceof Date ? data.startDate : new Date(data.startDate),
    endDate: data.endDate instanceof Date ? data.endDate : new Date(data.endDate),
    accountId: data.accountId,
  };
  await db.insert(budgets).values(record);
  return record;
};

export const updateBudget = async (id: string, data: Partial<BudgetInput>) => {
  const payload: Partial<Budget> = {};
  if (data.accountId !== undefined) payload.accountId = data.accountId;
  if (data.amountLimit !== undefined) payload.amountLimit = String(data.amountLimit);
  if (data.period !== undefined) payload.period = data.period;
  if (data.alertThreshold !== undefined) payload.alertThreshold = String(data.alertThreshold);
  if (data.startDate !== undefined) {
    payload.startDate = data.startDate instanceof Date ? data.startDate : new Date(data.startDate);
  }
  if (data.endDate !== undefined) {
    payload.endDate = data.endDate instanceof Date ? data.endDate : new Date(data.endDate);
  }

  await db.update(budgets).set(payload).where(eq(budgets.id, id));
  return getBudget(id);
};

export const deleteBudget = async (id: string) => {
  const record = await getBudget(id);
  if (!record) return null;
  await db.delete(budgets).where(eq(budgets.id, id));
  return record;
};
