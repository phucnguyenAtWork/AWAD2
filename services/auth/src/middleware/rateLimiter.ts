import { Elysia } from "elysia";

export type RateLimiterOptions = {
  windowMs: number;
  max: number;
  key?: (req: Request) => string;
};

type Counter = { count: number; resetAt: number };

export const rateLimiter = (options: RateLimiterOptions) => {
  const hits = new Map<string, Counter>();

  return new Elysia({ name: "rate-limiter" }).onBeforeHandle(
    ({ request, set }) => {
      const now = Date.now();
      const key =
        options.key?.(request) ??
        request.headers.get("x-forwarded-for") ??
        request.headers.get("x-real-ip") ??
        "global";

      const existing = hits.get(key);
      if (!existing || now > existing.resetAt) {
        hits.set(key, {
          count: 1,
          resetAt: now + options.windowMs,
        });
        return;
      }

      existing.count += 1;
      if (existing.count > options.max) {
        set.status = 429;
        return {
          message: "Too many requests. Please slow down.",
          retryAfterMs: existing.resetAt - now,
        };
      }
    }
  );
};
