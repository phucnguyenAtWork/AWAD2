import { Elysia, t } from "elysia";
import { BudgetsService } from "../services/budgets.service";
import { authGuardConfig, resolveUserId } from "../middleware/requireAuth";

const budgetResponse = t.Object({
  id: t.String(),
  accountId: t.String(),
  categoryId: t.Nullable(t.String()),
  amountLimit: t.String(),
  period: t.Union([t.Literal("MONTHLY"), t.Literal("WEEKLY")]),
  alertThreshold: t.String(),
  startDate: t.Any(),
  endDate: t.Any(),
  createdAt: t.Any(),
});

const budgetInput = t.Object({
  accountId: t.String(),
  categoryId: t.Optional(t.Nullable(t.String())),
  amountLimit: t.Number({ minimum: 0 }),
  period: t.Optional(t.Union([t.Literal("MONTHLY"), t.Literal("WEEKLY")])),
  alertThreshold: t.Optional(
    t.Number({
      minimum: 0,
      maximum: 1,
    })
  ),
  startDate: t.String({ format: "date" }),
  endDate: t.String({ format: "date" }),
});

const budgetUpdateInput = t.Partial(budgetInput);

const unauthorized = t.Object({ message: t.String() });

export const budgetsController = new Elysia({ prefix: "/budgets" })
  .guard(authGuardConfig)
  .resolve(resolveUserId)
  .get(
    "/",
    async ({ query }) => {
      return BudgetsService.list(query.accountId);
    },
    {
      query: t.Object({ accountId: t.Optional(t.String()) }),
      response: {
        200: t.Array(budgetResponse),
        401: unauthorized,
      },
      detail: {
        tags: ["Budgets"],
        summary: "List budgets",
        description: "Returns budgets; optionally filter by accountId.",
      },
    }
  )
  .post(
    "/",
    async ({ body }) => {
      return BudgetsService.create(body);
    },
    {
      body: budgetInput,
      response: {
        200: budgetResponse,
        401: unauthorized,
      },
      detail: {
        tags: ["Budgets"],
        summary: "Create budget",
      },
    }
  )
  .get(
    "/:id",
    async ({ params, set }) => {
      const budget = await BudgetsService.get(params.id);
      if (!budget) {
        set.status = 404;
        return { message: "Budget not found" };
      }
      return budget;
    },
    {
      params: t.Object({ id: t.String() }),
      response: {
        200: budgetResponse,
        401: unauthorized,
        404: t.Object({ message: t.String() }),
      },
      detail: {
        tags: ["Budgets"],
        summary: "Get budget",
      },
    }
  )
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      const updated = await BudgetsService.update(params.id, body);
      if (!updated) {
        set.status = 404;
        return { message: "Budget not found" };
      }
      return updated;
    },
    {
      params: t.Object({ id: t.String() }),
      body: budgetUpdateInput,
      response: {
        200: budgetResponse,
        401: unauthorized,
        404: t.Object({ message: t.String() }),
      },
      detail: {
        tags: ["Budgets"],
        summary: "Update budget",
      },
    }
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const deleted = await BudgetsService.delete(params.id);
      if (!deleted) {
        set.status = 404;
        return { message: "Budget not found" };
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
        tags: ["Budgets"],
        summary: "Delete budget",
      },
    }
  );
