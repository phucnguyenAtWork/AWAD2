import { Elysia, t } from "elysia";
import { AccountsService } from "../services/accounts.service";

const accountResponse = t.Object({
  id: t.String(),
  userId: t.String(),
  name: t.String(),
  type: t.Enum({
    CASH: "CASH",
    BANK: "BANK",
    WALLET: "WALLET",
    CREDIT: "CREDIT",
  }),
  currency: t.String(),
  frictionLevel: t.Enum({
    HIGH: "HIGH",
    MEDIUM: "MEDIUM",
    LOW: "LOW",
  }),
  createdAt: t.Any(), // serialized date
});

const accountInput = t.Object({
  userId: t.String(),
  name: t.String({ minLength: 1, maxLength: 128 }),
  type: t.Optional(
    t.Union([
      t.Literal("CASH"),
      t.Literal("BANK"),
      t.Literal("WALLET"),
      t.Literal("CREDIT"),
    ])
  ),
  currency: t.Optional(t.String({ maxLength: 8 })),
  frictionLevel: t.Optional(
    t.Union([t.Literal("HIGH"), t.Literal("MEDIUM"), t.Literal("LOW")])
  ),
});

const accountUpdateInput = t.Partial(accountInput);

export const accountsController = (app: Elysia) =>
  app.group("/accounts", (app) =>
    app
      .get(
        "/",
        async ({ query }) => AccountsService.list(query.userId),
        {
          query: t.Object({
            userId: t.Optional(t.String()),
          }),
          response: t.Array(accountResponse),
          detail: {
            tags: ["Accounts"],
            summary: "List accounts",
            description: "Returns all accounts. Optionally filter by userId.",
            responses: { 200: { description: "Array of accounts" } },
          },
        }
      )
      .post(
        "/",
        async ({ body }) => AccountsService.create(body),
        {
          body: accountInput,
          response: accountResponse,
          detail: {
            tags: ["Accounts"],
            summary: "Create account",
            description: "Creates a new account for the user.",
            responses: { 200: { description: "Account created" } },
          },
        }
      )
      .get(
        "/:id",
        async ({ params, set }) => {
          const account = await AccountsService.get(params.id);
          if (!account) {
            set.status = 404;
            return { message: "Account not found" };
          }
          return account;
        },
        {
          params: t.Object({ id: t.String() }),
          response: {
            200: accountResponse,
            404: t.Object({ message: t.String() }),
          },
          detail: {
            tags: ["Accounts"],
            summary: "Get account",
            responses: {
              200: { description: "Account found" },
              404: { description: "Account not found" },
            },
          },
        }
      )
      .patch(
        "/:id",
        async ({ params, body, set }) => {
          const updated = await AccountsService.update(params.id, body);
          if (!updated) {
            set.status = 404;
            return { message: "Account not found" };
          }
          return updated;
        },
        {
          params: t.Object({ id: t.String() }),
          body: accountUpdateInput,
          response: {
            200: accountResponse,
            404: t.Object({ message: t.String() }),
          },
          detail: {
            tags: ["Accounts"],
            summary: "Update account",
            responses: {
              200: { description: "Account updated" },
              404: { description: "Account not found" },
            },
          },
        }
      )
      .delete(
        "/:id",
        async ({ params, set }) => {
          const deleted = await AccountsService.delete(params.id);
          if (!deleted) {
            set.status = 404;
            return { message: "Account not found" };
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
            tags: ["Accounts"],
            summary: "Delete account",
            responses: {
              200: { description: "Account deleted" },
              404: { description: "Account not found" },
            },
          },
        }
      )
  );
