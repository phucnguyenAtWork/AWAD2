import { mysqlTable, varchar, decimal, timestamp, uniqueIndex } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

export const categoryBudgets = mysqlTable(
  "category_budgets",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`(uuid())`),

    userId: varchar("user_id", { length: 36 }).notNull(),

    categoryId: varchar("category_id", { length: 36 }).notNull(),

    monthlyLimit: decimal("monthly_limit", { precision: 15, scale: 2 }).notNull(),

    createdAt: timestamp("created_at").defaultNow(),

    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("user_category_idx").on(table.userId, table.categoryId),
  ]
);
