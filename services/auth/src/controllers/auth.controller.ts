import { Elysia, t } from "elysia";
import { ZodError } from "zod";
import { AuthService } from "../services/auth.service";
import { AppError } from "../util/errors";
import { requireAuth } from "../middleware/requireAuth";

const formatZod = (error: ZodError) =>
  error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));

const handleError = (error: unknown, set: { status?: number | string }) => {
  if (error instanceof AppError) {
    set.status = error.status;
    return { error: { message: error.message, code: error.code } };
  }
  if (error instanceof ZodError) {
    set.status = 400;
    return { error: { message: "Validation failed", details: formatZod(error) } };
  }
  set.status = 500;
  return { error: { message: "Internal server error" } };
};

export const authController = (app: Elysia) =>
  app.group("/auth", (app) =>
    app
      .post(
        "/register",
        async ({ body, set }) => {
          try {
            return await AuthService.register(body);
          } catch (error: unknown) {
            return handleError(error, set);
          }
        },
        {
          body: t.Object({
            phone: t.String({ minLength: 6, maxLength: 32 }),
            email: t.Optional(t.String({ format: "email", maxLength: 255 })),
            password: t.String({ minLength: 8, maxLength: 128 }),
            fullName: t.Optional(t.String({ maxLength: 255 })),
          }),
          detail: {
            tags: ["Auth"],
            summary: "Register new user",
          },
        }
      )
      .post(
        "/login",
        async ({ body, set }) => {
          try {
            return await AuthService.login(body);
          } catch (error: unknown) {
            return handleError(error, set);
          }
        },
        {
          body: t.Object({
            phone: t.Optional(t.String({ minLength: 6, maxLength: 32 })),
            email: t.Optional(t.String({ format: "email", maxLength: 255 })),
            password: t.String({ minLength: 8, maxLength: 128 }),
          }),
          detail: {
            tags: ["Auth"],
            summary: "Login with phone or email",
          },
        }
      )
      .get(
        "/me",
        async ({ request, set }) => {
          try {
            const user = await requireAuth(request, set);
            const profile = await AuthService.profile(user.id);
            return { user: profile };
          } catch (error: unknown) {
            return handleError(error, set);
          }
        },
        {
          detail: {
            tags: ["Auth"],
            summary: "Get current user profile",
          },
        }
      )
  );
