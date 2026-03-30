import { Elysia } from "elysia";
import swagger from "@elysiajs/openapi";
import cors from "@elysiajs/cors";
import { authController } from "./controllers/auth.controller";
import { rateLimiter } from "./middleware/rateLimiter";
import { closePool } from "./db";
import { env } from "./env";

export const app = new Elysia()
  .use(
    cors({
      origin: env.frontendOrigin || true,
      credentials: true,
    })
  )
  .use(
    swagger({
      path: "/docs",
      documentation: {
        info: {
          title: "Auth Service",
          version: "0.1.0",
        },
      },
    })
  )
  .use(
    rateLimiter({
      windowMs: env.rateLimit.windowMs,
      max: env.rateLimit.maxRequests,
    })
  )
  .get("/health", () => ({ status: "ok" }))
  .use(authController)
  .onStop(() => closePool());

export type AuthApp = typeof app;

app.listen(env.PORT, ({ hostname, port }) => {
  // eslint-disable-next-line no-console
  console.log(`Auth service listening at http://${hostname}:${port}`);
});
