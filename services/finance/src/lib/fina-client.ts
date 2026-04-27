/**
 * FINA Brain Client — Mac → Windows API calls
 *
 * Calls the FINA AI service running on Windows (GPU machine) for:
 * - AI chat, dashboard insights, forecasting
 * - Transaction categorization (single + batch)
 * - NLP normalization
 * - LSTM model training
 */
import { env } from "../env";

const FINA_URL = env.FINA_API_URL;
const RETRY_DELAYS_MS = [750, 1_500];
const TIMEOUT_MS = 60_000; // 60s — LLM inference on FINA can take 10-30s

// ─── Types ──────────────────────────────────────────────────────────

export type ChatRequest = {
  user_id: string;
  role: string;
  mode?: string;
  message: string;
};

export type ChatResponse = {
  response: string;
  model_output?: {
    kind?: string;
    message?: string;
    action?: unknown;
    signals?: string[];
    needs_clarification?: boolean;
  };
  intent?: string;
  actions?: unknown[];
  [key: string]: unknown;
};

export type DashboardResponse = {
  summary_cards: { label: string; value: string | number; change?: string }[];
  smart_insights: { title: string; description: string; type?: string }[];
  prediction: { projected_spend: number; currency: string; confidence: number; updated_at: string };
  [key: string]: unknown;
};

export type ForecastResponse = {
  weekly: unknown;
  monthly: unknown;
  confidence: number;
  source: string;
  [key: string]: unknown;
};

export type CategorizeRequest = {
  description: string;
  transaction_id?: string;
};

export type CategorizeResponse = {
  category: string;
  confidence: number;
  transaction_id?: string;
  [key: string]: unknown;
};

export type BatchCategorizeRequest = {
  items: CategorizeRequest[];
};

export type NormalizeResponse = {
  normalized: string;
  original: string;
  [key: string]: unknown;
};

export type TrainResponse = {
  status: string;
  epochs: number;
  [key: string]: unknown;
};

export type StatusResponse = {
  status: string;
  version?: string;
  models_loaded?: string[];
  [key: string]: unknown;
};

// ─── Internal helpers ───────────────────────────────────────────────

class FinaError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data?: unknown
  ) {
    super(`FINA API error ${status}: ${message}`);
    this.name = "FinaError";
  }
}

async function finaFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`${FINA_URL}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new FinaError(
          res.status,
          typeof data?.detail === "string" ? data.detail : res.statusText,
          data
        );
      }

      return data as T;
    } catch (err) {
      lastError = err;
      if (err instanceof FinaError) throw err;
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new FinaError(408, "FINA request timed out");
      }

      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined) break;
      console.warn(`[FINA] transient fetch failure for ${path}; retrying in ${delay}ms`, err);
      await new Promise((resolve) => setTimeout(resolve, delay));
    } finally {
      clearTimeout(timeout);
    }
  }

  const err = lastError as Error;
  throw new FinaError(503, `FINA unreachable: ${err?.message ?? "connection failed"}`);
}

// ─── Public API ─────────────────────────────────────────────────────

export const fina = {
  /** AI chat — send user message, get AI reply */
  chat: (userId: string, role: string, message: string, mode = "Standard", history: { role: string; content: string }[] = []) =>
    finaFetch<ChatResponse>("/chat", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, role, mode, message, history }),
    }),

  /** Dashboard insights for a user */
  dashboard: (userId: string, role = "user") =>
    finaFetch<DashboardResponse>(`/dashboard/${userId}?role=${role}`),

  /** Spending forecast for a user */
  forecast: (userId: string) =>
    finaFetch<ForecastResponse>(`/forecast/${userId}`),

  /** Categorize a single transaction description */
  categorize: (description: string, transactionId?: string) =>
    finaFetch<CategorizeResponse>("/categorize", {
      method: "POST",
      body: JSON.stringify({ description, transaction_id: transactionId }),
    }),

  /** Batch categorize multiple transactions */
  categorizeBatch: (items: CategorizeRequest[]) =>
    finaFetch<CategorizeResponse[]>("/categorize/batch", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),

  /** NLP normalize a description */
  normalize: (description: string) =>
    finaFetch<NormalizeResponse>("/nlp/normalize", {
      method: "POST",
      body: JSON.stringify({ description }),
    }),

  /** Trigger LSTM training for a user */
  trainLstm: (userId: string, epochs = 50) =>
    finaFetch<TrainResponse>(`/train/lstm/${userId}?epochs=${epochs}`, {
      method: "POST",
    }),

  /** Health check */
  status: () => finaFetch<StatusResponse>("/status"),

  /** Check if FINA brain is reachable */
  isAvailable: async (): Promise<boolean> => {
    try {
      await fina.status();
      return true;
    } catch {
      return false;
    }
  },
};
