import { randomUUID } from "crypto";
import { eq, or } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { db } from "../db";
import { authUsers } from "../schemas";

export type AuthUser = InferSelectModel<typeof authUsers>;

export type CreateUserInput = {
  phone: string;
  email?: string | null;
  passwordHash: string;
  fullName?: string | null;
};

export const findById = async (id: string) => {
  const [user] = await db
    .select()
    .from(authUsers)
    .where(eq(authUsers.id, id))
    .limit(1);
  return user ?? null;
};

export const findByPhoneOrEmail = async (params: {
  phone?: string;
  email?: string | null;
}) => {
  if (!params.phone && !params.email) return null;

  const conditions = [];
  if (params.phone) conditions.push(eq(authUsers.phone, params.phone));
  if (params.email) conditions.push(eq(authUsers.email, params.email));

  const whereClause =
    conditions.length === 1 ? conditions[0] : or(...conditions);

  const [user] = await db
    .select()
    .from(authUsers)
    .where(whereClause)
    .limit(1);

  return user ?? null;
};

export const createUser = async (data: CreateUserInput) => {
  const record: AuthUser = {
    id: randomUUID(),
    phone: data.phone,
    email: data.email ?? null,
    passwordHash: data.passwordHash,
    fullName: data.fullName ?? null,
    createdAt: new Date(),
  };

  await db.insert(authUsers).values(record);
  return record;
};

export const existsWithPhone = async (phone: string) => {
  const user = await findByPhoneOrEmail({ phone });
  return Boolean(user);
};

export const existsWithEmail = async (email: string) => {
  const user = await findByPhoneOrEmail({ email });
  return Boolean(user);
};
