import { Elysia, t } from "elysia";
import { BudgetsService } from "../services/budgets.service";

const budgetResponse = t.Object({
  id: t.String(),
  accountId: t.String(),
  amountLimit: t.String(),
  period: t.Union([t.Literal("MONTHLY"), t.Literal("WEEKLY")]),
  alertThreshold: t.String(),
  startDate: t.Any(),
  endDate: t.Any(),
  createdAt: t.Any(),
});

const budgetInput = t.Object({
  accountId: t.String(),
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

export const budgetsController = (app: Elysia) =>
  app.group("/budgets", (app) =>
    app
      .get(
        "/",
        async ({ query }) => BudgetsService.list(query.accountId),
        {
          query: t.Object({ accountId: t.Optional(t.String()) }),
          response: t.Array(budgetResponse),
          detail: {
            tags: ["Budgets"],
            summary: "List budgets",
            description: "Returns budgets; optionally filter by accountId.",
            responses: { 200: { description: "Array of budgets" } },
          },
        }
      )
      .post(
        "/",
        async ({ body }) => BudgetsService.create(body),
        {
          body: budgetInput,
          response: budgetResponse,
          detail: {
            tags: ["Budgets"],
            summary: "Create budget",
            responses: { 200: { description: "Budget created" } },
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
          response: { 200: budgetResponse, 404: t.Object({ message: t.String() }) },
          detail: {
            tags: ["Budgets"],
            summary: "Get budget",
            responses: { 200: { description: "Budget found" }, 404: { description: "Not found" } },
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
          response: { 200: budgetResponse, 404: t.Object({ message: t.String() }) },
          detail: {
            tags: ["Budgets"],
            summary: "Update budget",
            responses: { 200: { description: "Budget updated" }, 404: { description: "Not found" } },
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
            404: t.Object({ message: t.String() }),
          },
          detail: {
            tags: ["Budgets"],
            summary: "Delete budget",
            responses: { 200: { description: "Budget deleted" }, 404: { description: "Not found" } },
          },
        }
      )
  );
