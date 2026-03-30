import { Elysia } from "elysia";
import swagger from "@elysiajs/openapi";
import cors from "@elysiajs/cors";
import { accountsController } from "./controllers/accounts.controller";
import { categoriesController } from "./controllers/categories.controller";
import { transactionsController } from "./controllers/transactions.controller";
import { budgetsController } from "./controllers/budgets.controller";
import { closePool } from "./db";
import { env } from "./env";

const PORT = env.PORT;

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
          title: "Finance Service",
          version: "0.1.0",
        },
      },
    })
  )
  .get("/health", () => ({ status: "ok" }))
  .use(accountsController)
  .use(categoriesController)
  .use(transactionsController)
  .use(budgetsController)
  .onStop(() => closePool());

export type FinanceApp = typeof app;

app.listen(PORT, ({ hostname, port }) => {
  // eslint-disable-next-line no-console
  console.log(`Finance service listening at http://${hostname}:${port}`);
});
