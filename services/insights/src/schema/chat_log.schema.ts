import { mysqlTable, bigint, char, text, json, timestamp, int, varchar, tinyint } from "drizzle-orm/mysql-core";

export const chatLogs = mysqlTable("chat_logs", {
  id: bigint("id", { mode: "number", unsigned: false })
    .autoincrement()
    .primaryKey(),

  accountId: char("account_id", { length: 36 }).notNull(),

  userQuery: text("user_query"),
  aiResponse: text("ai_response"),
  contextSnapshot: json("context_snapshot"),

  // Extended fields for RAG pipeline traceability
  action: json("action"),
  modelName: varchar("model_name", { length: 64 }),
  latencyMs: int("latency_ms"),
  promptTokens: int("prompt_tokens"),
  responseTokens: int("response_tokens"),
  requestId: varchar("request_id", { length: 36 }),

  // User feedback for RLHF-style quality tracking
  // 1 = thumbs up, -1 = thumbs down, NULL = no feedback
  feedback: tinyint("feedback"),

  timestamp: timestamp("timestamp").defaultNow(),
});
