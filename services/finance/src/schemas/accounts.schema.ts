import { mysqlTable, varchar, mysqlEnum, timestamp } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

export const ROLES = ["Student", "Worker", "Freelancer"] as const;
export type Role = (typeof ROLES)[number];

export const accounts = mysqlTable("accounts", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`(uuid())`),

  userId: varchar("user_id", { length: 36 })
    .notNull(),

  name: varchar("name", { length: 255 }).notNull(),

  type: mysqlEnum("type", ["CASH", "BANK", "WALLET", "CREDIT"])
    .default("CASH")
    .notNull(),

  currency: varchar("currency", { length: 8 })
    .default("VND")
    .notNull(),

  role: mysqlEnum("role", ["Student", "Worker", "Freelancer"])
    .default("Student")
    .notNull(),

  frictionLevel: mysqlEnum("friction_level", ["HIGH", "MEDIUM", "LOW"])
    .default("LOW")
    .notNull(),

  createdAt: timestamp("created_at").defaultNow(),
});
