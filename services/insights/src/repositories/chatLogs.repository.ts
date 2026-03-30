import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { chatLogs } from "../schema/chat_log.schema";

export type ChatLog = typeof chatLogs.$inferSelect;
export type NewChatLog = typeof chatLogs.$inferInsert;

export const ChatLogsRepository = {
  async create(log: NewChatLog): Promise<ChatLog> {
    await db.insert(chatLogs).values(log);
    // MySQL doesn't support RETURNING; fetch the last inserted row
    const [row] = await db
      .select()
      .from(chatLogs)
      .where(eq(chatLogs.accountId, log.accountId!))
      .orderBy(desc(chatLogs.id))
      .limit(1);
    return row!;
  },

  async listByAccount(accountId: string, limit = 100) {
    return db
      .select()
      .from(chatLogs)
      .where(eq(chatLogs.accountId, accountId))
      .orderBy(desc(chatLogs.timestamp))
      .limit(limit);
  },

  async get(id: number) {
    const [row] = await db.select().from(chatLogs).where(eq(chatLogs.id, id)).limit(1);
    return row ?? null;
  },

  async delete(id: number) {
    const row = await this.get(id);
    if (!row) return null;
    await db.delete(chatLogs).where(eq(chatLogs.id, id));
    return row;
  },
};
