import { Elysia } from "elysia";
import swagger from "@elysiajs/openapi";
import cors from "@elysiajs/cors";
import { chatController } from "./controllers/chat.controller";
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
        info: { title: "Insights Service", version: "0.1.0" },
      },
    })
  )
  .get("/health", () => ({ status: "ok" }))
  .use(chatController)
  .onStop(() => closePool());

app.listen(env.PORT, ({ hostname, port }) => {
  console.log(`Insights service listening at http://${hostname}:${port}`);
});
