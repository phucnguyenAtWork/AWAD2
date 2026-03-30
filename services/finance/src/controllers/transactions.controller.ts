import { Elysia, t } from "elysia";
import { TransactionsService } from "../services/transactions.service";
import { authGuardConfig, resolveUserId } from "../middleware/requireAuth";

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

const unauthorized = t.Object({ message: t.String() });

export const transactionsController = new Elysia({ prefix: "/transactions" })
  .guard(authGuardConfig)
  .resolve(resolveUserId)
  .get(
    "/",
    async ({ query, userId }) => {
      return TransactionsService.list(query.userId ?? userId);
    },
    {
      query: t.Object({ userId: t.Optional(t.String()) }),
      response: {
        200: t.Array(transactionResponse),
        401: unauthorized,
      },
      detail: {
        tags: ["Transactions"],
        summary: "List transactions",
        description: "Returns transactions; optionally filter by userId.",
      },
    }
  )
  .post(
    "/",
    async ({ body, userId }) => {
      return TransactionsService.create({ ...body, userId });
    },
    {
      body: transactionInput,
      response: {
        200: transactionResponse,
        401: unauthorized,
      },
      detail: {
        tags: ["Transactions"],
        summary: "Create transaction",
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
      response: {
        200: transactionResponse,
        401: unauthorized,
        404: t.Object({ message: t.String() }),
      },
      detail: {
        tags: ["Transactions"],
        summary: "Get transaction",
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
      response: {
        200: transactionResponse,
        401: unauthorized,
        404: t.Object({ message: t.String() }),
      },
      detail: {
        tags: ["Transactions"],
        summary: "Update transaction",
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
        401: unauthorized,
        404: t.Object({ message: t.String() }),
      },
      detail: {
        tags: ["Transactions"],
        summary: "Delete transaction",
      },
    }
  );
