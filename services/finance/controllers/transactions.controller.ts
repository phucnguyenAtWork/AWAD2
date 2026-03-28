import { Elysia, t } from "elysia";
import { TransactionsService } from "../services/transactions.service";

const transactionResponse = t.Object({
  id: t.String(),
  userId: t.String(),
  type: t.Union([t.Literal("EXPENSE"), t.Literal("INCOME")]),
  amount: t.String(),
  currency: t.String(),
  description: t.Nullable(t.String()),
  categoryId: t.Nullable(t.String()),
  essential: t.Boolean(),
  tags: t.Optional(t.Any()),
  occurredAt: t.Any(),
});

const transactionInput = t.Object({
  userId: t.String(),
  type: t.Union([t.Literal("EXPENSE"), t.Literal("INCOME")]),
  amount: t.Number({ minimum: 0 }),
  currency: t.Optional(t.String({ maxLength: 8 })),
  description: t.Optional(t.String({ maxLength: 512 })),
  categoryId: t.Optional(t.String()),
  essential: t.Optional(t.Boolean()),
  tags: t.Optional(t.Array(t.String())),
  occurredAt: t.Optional(t.String({ format: "date-time" })),
});

const transactionUpdateInput = t.Partial(transactionInput);

export const transactionsController = (app: Elysia) =>
  app.group("/transactions", (app) =>
    app
      .get(
        "/",
        async ({ query }) => TransactionsService.list(query.userId),
        {
          query: t.Object({ userId: t.Optional(t.String()) }),
          response: t.Array(transactionResponse),
          detail: {
            tags: ["Transactions"],
            summary: "List transactions",
            description: "Returns transactions; optionally filter by userId.",
            responses: { 200: { description: "Array of transactions" } },
          },
        }
      )
      .post(
        "/",
        async ({ body }) => TransactionsService.create(body),
        {
          body: transactionInput,
          response: transactionResponse,
          detail: {
            tags: ["Transactions"],
            summary: "Create transaction",
            responses: { 200: { description: "Transaction created" } },
          },
        }
      )
      .get(
        "/:id",
        async ({ params, set }) => {
          const transaction = await TransactionsService.get(params.id);
          if (!transaction) {
            set.status = 404;
            return { message: "Transaction not found" };
          }
          return transaction;
        },
        {
          params: t.Object({ id: t.String() }),
          response: { 200: transactionResponse, 404: t.Object({ message: t.String() }) },
          detail: {
            tags: ["Transactions"],
            summary: "Get transaction",
            responses: { 200: { description: "Transaction found" }, 404: { description: "Not found" } },
          },
        }
      )
      .patch(
        "/:id",
        async ({ params, body, set }) => {
          const updated = await TransactionsService.update(params.id, body);
          if (!updated) {
            set.status = 404;
            return { message: "Transaction not found" };
          }
          return updated;
        },
        {
          params: t.Object({ id: t.String() }),
          body: transactionUpdateInput,
          response: { 200: transactionResponse, 404: t.Object({ message: t.String() }) },
          detail: {
            tags: ["Transactions"],
            summary: "Update transaction",
            responses: { 200: { description: "Transaction updated" }, 404: { description: "Not found" } },
          },
        }
      )
      .delete(
        "/:id",
        async ({ params, set }) => {
          const deleted = await TransactionsService.delete(params.id);
          if (!deleted) {
            set.status = 404;
            return { message: "Transaction not found" };
          }
          return { success: true };
        },
        {
          params: t.Object({ id: t.String() }),
          response: {
            200: t.Object({ success: t.Boolean() }),
            404: t.Object({ message: t.String() }),
          },
          detail: {
            tags: ["Transactions"],
            summary: "Delete transaction",
            responses: { 200: { description: "Transaction deleted" }, 404: { description: "Not found" } },
          },
        }
      )
  );
