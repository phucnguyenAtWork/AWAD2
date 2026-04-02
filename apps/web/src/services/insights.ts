import { request } from './http';
import type { JsonValue } from './types';

const INSIGHTS_BASE = (import.meta.env.VITE_INSIGHTS_API_URL ?? 'http://localhost:4004').replace(/\/+$/, '');

export type ChatPayload = {
  prompt: string;
  displayCurrency?: string;
};

export type ChatResponse = {
  response: string;
  log: InsightLog;
  request_id: string;
};

export type InsightLog = {
  id: number;
  account_id: string;
  user_query: string | null;
  ai_response: string | null;
  context_snapshot: JsonValue | null;
  action: JsonValue | null;
  model_name: string | null;
  latency_ms: number | null;
  prompt_tokens: number | null;
  response_tokens: number | null;
  request_id: string | null;
  feedback: number | null; // 1 = thumbs up, -1 = thumbs down, null = no feedback
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

  async submitFeedback(token: string, logId: number, feedback: 1 | -1 | 0, options: { onUnauthorized?: () => void } = {}): Promise<InsightLog> {
    return request<InsightLog, { feedback: number }>(INSIGHTS_BASE, `/insights/logs/${logId}/feedback`, {
      method: 'PATCH',
      token,
      body: { feedback },
      ...options,
    });
  },
};
