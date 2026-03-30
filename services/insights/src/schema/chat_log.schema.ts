import { mysqlTable, bigint, char, text, json, timestamp } from "drizzle-orm/mysql-core";

export const chatLogs = mysqlTable("chat_logs", {
  id: bigint("id", { mode: "number", unsigned: false })
    .autoincrement()
    .primaryKey(),

  accountId: char("account_id", { length: 36 }).notNull(),

  userQuery: text("user_query"),
  aiResponse: text("ai_response"),
  contextSnapshot: json("context_snapshot"),
  timestamp: timestamp("timestamp").defaultNow(),
});