import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import swagger from "@elysiajs/openapi";
import { accountsController } from "./controllers/accounts.controller";
import { categoriesController } from "./controllers/categories.controller";
import { transactionsController } from "./controllers/transactions.controller";
import { budgetsController } from "./controllers/budgets.controller";
import { closePool } from "./db";
import { env } from "./env";

const PORT = env.PORT;

const app = new Elysia({ adapter: node() })
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

app.listen(PORT, ({ hostname, port }) => {
  // eslint-disable-next-line no-console
  console.log(`Finance service listening at http://${hostname}:${port}`);
});
