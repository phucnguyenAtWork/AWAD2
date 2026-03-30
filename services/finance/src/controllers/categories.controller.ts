import { Elysia, t } from "elysia";
import { CategoriesService } from "../services/categories.service";
import { authGuardConfig, resolveUserId } from "../middleware/requireAuth";

const categoryResponse = t.Object({
  id: t.String(),
  accountId: t.Nullable(t.String()),
  name: t.String(),
  icon: t.Nullable(t.String()),
  type: t.Union([t.Literal("EXPENSE"), t.Literal("INCOME")]),
  createdAt: t.Any(),
});

const categoryInput = t.Object({
  accountId: t.Optional(t.String()),
  name: t.String({ minLength: 1, maxLength: 128 }),
  icon: t.Optional(t.String({ maxLength: 50 })),
  type: t.Optional(t.Union([t.Literal("EXPENSE"), t.Literal("INCOME")])),
});

const categoryUpdateInput = t.Partial(categoryInput);

const unauthorized = t.Object({ message: t.String() });

export const categoriesController = new Elysia({ prefix: "/categories" })
  .guard(authGuardConfig)
  .resolve(resolveUserId)
  .get(
    "/",
    async ({ query }) => {
      return CategoriesService.list(query.accountId);
    },
    {
      query: t.Object({ accountId: t.Optional(t.String()) }),
      response: {
        200: t.Array(categoryResponse),
        401: unauthorized,
      },
      detail: {
        tags: ["Categories"],
        summary: "List categories",
        description: "Returns categories; optionally filter by accountId.",
      },
    }
  )
  .post(
    "/",
    async ({ body }) => {
      return CategoriesService.create(body);
    },
    {
      body: categoryInput,
      response: {
        200: categoryResponse,
        401: unauthorized,
      },
      detail: {
        tags: ["Categories"],
        summary: "Create category",
      },
    }
  )
  .get(
    "/:id",
    async ({ params, set }) => {
      const category = await CategoriesService.get(params.id);
      if (!category) {
        set.status = 404;
        return { message: "Category not found" };
      }
      return category;
    },
    {
      params: t.Object({ id: t.String() }),
      response: {
        200: categoryResponse,
        401: unauthorized,
        404: t.Object({ message: t.String() }),
      },
      detail: {
        tags: ["Categories"],
        summary: "Get category",
      },
    }
  )
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      const updated = await CategoriesService.update(params.id, body);
      if (!updated) {
        set.status = 404;
        return { message: "Category not found" };
      }
      return updated;
    },
    {
      params: t.Object({ id: t.String() }),
      body: categoryUpdateInput,
      response: {
        200: categoryResponse,
        401: unauthorized,
        404: t.Object({ message: t.String() }),
      },
      detail: {
        tags: ["Categories"],
        summary: "Update category",
      },
    }
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const deleted = await CategoriesService.delete(params.id);
      if (!deleted) {
        set.status = 404;
        return { message: "Category not found" };
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
        tags: ["Categories"],
        summary: "Delete category",
      },
    }
  );
