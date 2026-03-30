import { Elysia, t } from "elysia";
import { ChatService } from "../services/chat.service";
import { authGuardConfig, resolveUserId } from "../middleware/requireAuth";

export const chatController = new Elysia({ prefix: "/insights" })
  .guard(authGuardConfig)
  .resolve(resolveUserId)
  .post(
    "/chat",
    async ({ body, userId, request, set }) => {
      try {
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.slice(authHeader.indexOf(" ") + 1);
        const result = await ChatService.chat({
          userId,
          token,
          prompt: body.prompt,
          displayCurrency: body.displayCurrency,
        });
        return { response: result.response, log: result.log };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Chat failed";
        const isRateLimit = message.includes("429") || message.includes("quota");
        set.status = isRateLimit ? 429 : 500;
        return { error: isRateLimit ? "AI rate limit exceeded. Please wait a moment and try again." : message };
      }
    },
    {
      body: t.Object({
        prompt: t.String({ minLength: 1 }),
        displayCurrency: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Insights"],
        summary: "Ask AI assistant (RAG-powered)",
      },
    }
  )
  .get(
    "/logs",
    async ({ query, userId }) => ChatService.list(query.accountId ?? userId, query.limit),
    {
      query: t.Object({
        accountId: t.Optional(t.String()),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 500 })),
      }),
      detail: { tags: ["Insights"], summary: "List chat logs" },
    }
  )
  .get(
    "/logs/:id",
    async ({ params, set }) => {
      const log = await ChatService.get(Number(params.id));
      if (!log) {
        set.status = 404;
        return { error: "Not found" };
      }
      return log;
    },
    {
      params: t.Object({ id: t.Numeric() }),
      detail: { tags: ["Insights"], summary: "Get a single log" },
    }
  )
  .delete(
    "/logs/:id",
    async ({ params, set }) => {
      const log = await ChatService.delete(Number(params.id));
      if (!log) {
        set.status = 404;
        return { error: "Not found" };
      }
      return { success: true };
    },
    {
      params: t.Object({ id: t.Numeric() }),
      detail: { tags: ["Insights"], summary: "Delete a log" },
    }
  );
