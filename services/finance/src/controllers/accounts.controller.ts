import { Elysia, t } from "elysia";
import { AccountsService } from "../services/accounts.service";
import { authGuardConfig, resolveUserId } from "../middleware/requireAuth";

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
  role: t.Enum({
    Student: "Student",
    Worker: "Worker",
    Freelancer: "Freelancer",
    Parent: "Parent",
    Retiree: "Retiree",
  }),
  frictionLevel: t.Enum({
    HIGH: "HIGH",
    MEDIUM: "MEDIUM",
    LOW: "LOW",
  }),
  createdAt: t.Any(),
});

const accountInput = t.Object({
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
  role: t.Optional(
    t.Union([
      t.Literal("Student"),
      t.Literal("Worker"),
      t.Literal("Freelancer"),
      t.Literal("Parent"),
      t.Literal("Retiree"),
    ])
  ),
  frictionLevel: t.Optional(
    t.Union([t.Literal("HIGH"), t.Literal("MEDIUM"), t.Literal("LOW")])
  ),
});

const accountUpdateInput = t.Partial(accountInput);

const unauthorized = t.Object({ message: t.String() });

export const accountsController = new Elysia({ prefix: "/accounts" })
  .guard(authGuardConfig)
  .resolve(resolveUserId)
  .get(
    "/",
    async ({ query, userId }) => {
      return AccountsService.list(query.userId ?? userId);
    },
    {
      query: t.Object({
        userId: t.Optional(t.String()),
      }),
      response: {
        200: t.Array(accountResponse),
        401: unauthorized,
      },
      detail: {
        tags: ["Accounts"],
        summary: "List accounts",
        description: "Returns all accounts. Optionally filter by userId.",
      },
    }
  )
  .post(
    "/",
    async ({ body, userId }) => {
      return AccountsService.create({ ...body, userId });
    },
    {
      body: accountInput,
      response: {
        200: accountResponse,
        401: unauthorized,
      },
      detail: {
        tags: ["Accounts"],
        summary: "Create account",
        description: "Creates a new account for the user.",
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
        401: unauthorized,
        404: t.Object({ message: t.String() }),
      },
      detail: {
        tags: ["Accounts"],
        summary: "Get account",
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
        401: unauthorized,
        404: t.Object({ message: t.String() }),
      },
      detail: {
        tags: ["Accounts"],
        summary: "Update account",
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
        401: unauthorized,
        404: t.Object({ message: t.String() }),
      },
      detail: {
        tags: ["Accounts"],
        summary: "Delete account",
      },
    }
  );
