import { mysqlTable, varchar, mysqlEnum, decimal, boolean, json, datetime } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

export const transactions = mysqlTable("transactions", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`(uuid())`),

  userId: varchar("user_id", { length: 36 })
    .notNull(),

  type: mysqlEnum("type", ["EXPENSE", "INCOME"])
    .notNull(),

  amount: decimal("amount", { precision: 14, scale: 2 })
    .notNull(),

  currency: varchar("currency", { length: 8 })
    .default("VND")
    .notNull(),

  description: varchar("description", { length: 512 }),

  categoryId: varchar("category_id", { length: 36 }),

  essential: boolean("essential")
    .default(false),
  tags: json("tags"),
  occurredAt: datetime("occurred_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});
