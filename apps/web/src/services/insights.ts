import { request } from './http';
import type { JsonValue } from './types';

// On this branch, chat goes through FINA Brain via finance service, not Gemini RAG
const INSIGHTS_BASE = (import.meta.env.VITE_INSIGHTS_API_URL ?? 'http://localhost:4001').replace(/\/+$/, '');

export type HistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type ChatPayload = {
  prompt: string;
  displayCurrency?: string;
  history?: HistoryMessage[];
};

export type ActionResult = {
  type: string;
  success: boolean;
  record?: Record<string, JsonValue>;
  error?: string;
};

export type ChatResponse = {
  response: string;
  action?: ActionResult | null;
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

export type DashboardData = {
  summary_cards: { label: string; value: string | number; change?: string }[];
  smart_insights: { title: string; description: string; type?: string }[];
  prediction: { projected_spend: number; currency: string; confidence: number; updated_at: string };
};

export const insightsService = {
  async chat(token: string, payload: ChatPayload, options: { onUnauthorized?: () => void } = {}): Promise<ChatResponse> {
    return request<ChatResponse, ChatPayload>(INSIGHTS_BASE, '/api/fina/chat', {
      method: 'POST',
      token,
      body: payload,
      ...options,
    });
  },

  async listLogs(token: string, accountId: string, limit = 50, options: { onUnauthorized?: () => void } = {}): Promise<InsightLog[]> {
    const query = `?accountId=${encodeURIComponent(accountId)}&limit=${limit}`;
    return request<InsightLog[]>(INSIGHTS_BASE, `/api/fina/logs${query}`, { token, ...options });
  },

  async submitFeedback(token: string, logId: number, feedback: 1 | -1 | 0, options: { onUnauthorized?: () => void } = {}): Promise<InsightLog> {
    return request<InsightLog, { feedback: number }>(INSIGHTS_BASE, `/api/fina/logs/${logId}/feedback`, {
      method: 'PATCH',
      token,
      body: { feedback },
      ...options,
    });
  },

  async dashboard(token: string, options: { onUnauthorized?: () => void } = {}): Promise<DashboardData> {
    return request<DashboardData>(INSIGHTS_BASE, '/api/fina/dashboard', { token, ...options });
  },
};
