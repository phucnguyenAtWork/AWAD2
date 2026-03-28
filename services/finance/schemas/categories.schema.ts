import { mysqlTable, varchar, mysqlEnum, timestamp } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

export const categories = mysqlTable("categories", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`(uuid())`),

  accountId: varchar("account_id", { length: 36 }),

  name: varchar("name", { length: 128 })
    .notNull(),

  icon: varchar("icon", { length: 50 }),

  type: mysqlEnum("type", ["EXPENSE", "INCOME"])
    .default("EXPENSE")
    .notNull(),

  createdAt: timestamp("created_at")
    .defaultNow(),
});
