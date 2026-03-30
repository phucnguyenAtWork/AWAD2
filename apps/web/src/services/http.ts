import type { JsonValue } from './types';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RequestOptions<TBody extends JsonValue | undefined> = {
  method?: HttpMethod;
  token?: string;
  body?: TBody;
  signal?: AbortSignal;
  onUnauthorized?: () => void;
};

export class ApiError<T = JsonValue> extends Error {
  readonly status?: number;
  readonly data?: T;

  constructor(message: string, status?: number, data?: T) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const buildUrl = (base: string, path: string): string => {
  const cleanBase = base.replace(/\/+$/, '');
  const cleanPath = `/${path.replace(/^\/+/, '')}`;
  return `${cleanBase}${cleanPath}`;
};

export async function request<TResponse extends JsonValue, TBody extends JsonValue | undefined = undefined>(
  baseUrl: string,
  path: string,
  { method = 'GET', body, token, signal, onUnauthorized }: RequestOptions<TBody> = {}
): Promise<TResponse> {
  const url = buildUrl(baseUrl, path);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  const contentType = res.headers.get('content-type') ?? '';
  const payload: JsonValue = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    if (res.status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    const message = typeof payload === 'string'
      ? payload
      : (payload && typeof payload === 'object' && !Array.isArray(payload))
        ? ((payload as Record<string, JsonValue>).error as Record<string, JsonValue>)?.message as string
          ?? (payload as Record<string, JsonValue>).message as string
          ?? `HTTP ${res.status}`
        : `HTTP ${res.status}`;
    throw new ApiError(message, res.status, payload as TResponse);
  }

  return payload as TResponse;
}
