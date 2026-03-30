import { mysqlTable, varchar, decimal, date, mysqlEnum, timestamp } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";


export const budgets = mysqlTable("budgets", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`(uuid())`),

  accountId: varchar("account_id", { length: 36 })
    .notNull(),

  categoryId: varchar("category_id", { length: 36 }),

  amountLimit: decimal("amount_limit", { precision: 14, scale: 2 })
    .notNull(),

  period: mysqlEnum("period", ["MONTHLY", "WEEKLY"])
    .default("MONTHLY")
    .notNull(),

  alertThreshold: decimal("alert_threshold", { precision: 3, scale: 2 })
    .default("0.80")
    .notNull(),

  startDate: date("start_date")
    .notNull(),

  endDate: date("end_date")
    .notNull(),

  createdAt: timestamp("created_at")
    .defaultNow(),
});
