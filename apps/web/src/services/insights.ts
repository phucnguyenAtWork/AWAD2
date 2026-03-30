import { request } from './http';
import type { JsonValue } from './types';

const INSIGHTS_BASE = (import.meta.env.VITE_INSIGHTS_API_URL ?? 'http://localhost:4003').replace(/\/+$/, '');

export type ChatPayload = {
  prompt: string;
};

export type ChatResponse = {
  response: string;
  log: InsightLog;
};

export type InsightLog = {
  id: number;
  accountId: string;
  userQuery: string | null;
  aiResponse: string | null;
  contextSnapshot: JsonValue | null;
  timestamp: string | null;
};

export const insightsService = {
  async chat(token: string, payload: ChatPayload, options: { onUnauthorized?: () => void } = {}): Promise<ChatResponse> {
    return request<ChatResponse, ChatPayload>(INSIGHTS_BASE, '/insights/chat', {
      method: 'POST',
      token,
      body: payload,
      ...options,
    });
  },

  async listLogs(token: string, accountId: string, limit = 50, options: { onUnauthorized?: () => void } = {}): Promise<InsightLog[]> {
    const query = `?accountId=${encodeURIComponent(accountId)}&limit=${limit}`;
    return request<InsightLog[]>(INSIGHTS_BASE, `/insights/logs${query}`, { token, ...options });
  },
};
