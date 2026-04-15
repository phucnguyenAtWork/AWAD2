import { mysqlTable, varchar, int, timestamp } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

export const budgetPreferences = mysqlTable("budget_preferences", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`(uuid())`),

  userId: varchar("user_id", { length: 36 })
    .notNull()
    .unique(),

  needsPct: int("needs_pct").notNull().default(50),

  wantsPct: int("wants_pct").notNull().default(30),

  savingsPct: int("savings_pct").notNull().default(20),

  createdAt: timestamp("created_at").defaultNow(),

  updatedAt: timestamp("updated_at").defaultNow(),
});
