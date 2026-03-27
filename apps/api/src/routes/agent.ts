import crypto from "node:crypto";
import { z } from "zod";
import { toUserFacingLlmErrorMessage, isRetryableLlmError } from "../../../../src/llm/errors.js";
import { executeAgentTurn } from "../agent/execute-turn.js";
import { jsonError, jsonRoute, readIdempotencyKey, readJsonBody } from "../server/http.js";
import type { AuthedRouteContext } from "./types.js";
import { buildChatHistoryRoutePayload, buildTaskStateRoutePayload } from "./utils.js";
import { buildIdempotencyExpiry } from "../idempotency/store.js";

const agentTurnSchema = z
  .object({
    message: z.string().trim().min(1).optional(),
    action: z.enum(["confirm", "cancel"]).optional(),
    optionValue: z.string().trim().min(1).optional(),
  })
  .refine((value) => Boolean(value.message || value.action || value.optionValue), {
    message: "A message or action is required.",
  });

export async function handleAgentRoute(ctx: AuthedRouteContext) {
  if (ctx.req.method === "POST" && ctx.url.pathname === "/api/v1/agent/turn") {
    const requestBody = await readJsonBody(ctx.req, ctx.config.maxRequestBodyBytes);
    const body = agentTurnSchema.safeParse(requestBody);
    if (!body.success) {
      return await jsonError(ctx.res, 400, "VALIDATION_ERROR", "A message or action is required.", false);
    }
    const idempotencyKey = readIdempotencyKey(ctx.req);
    const requestHash = idempotencyKey ? hashRequest(ctx.url.pathname, requestBody) : null;
    if (idempotencyKey && requestHash) {
      const replay = await ctx.idempotency.load(ctx.session.sessionId, idempotencyKey);
      if (replay) {
        if (replay.requestHash !== requestHash) {
          return await jsonError(
            ctx.res,
            409,
            "IDEMPOTENCY_CONFLICT",
            "Idempotency key already used for a different request.",
            false,
          );
        }
        ctx.res.setHeader("x-idempotent-replay", "true");
        return await jsonRoute(ctx.res, replay.status, replay.response);
      }
    }
    let result;
    try {
      result = await executeAgentTurn({
        config: ctx.config,
        session: ctx.session,
        profile: ctx.profile,
        workspace: ctx.workspace,
        googleClients: ctx.googleClients,
        action: toAgentAction(body.data),
      });
    } catch (error) {
      if (!isRetryableLlmError(error)) {
        throw error;
      }
      const job = await ctx.jobs.enqueue({
        kind: "agent_turn_retry",
        payload: {
          sessionId: ctx.session.sessionId,
          action: toAgentAction(body.data),
        },
        maxAttempts: ctx.config.jobMaxAttempts,
        runAt: new Date().toISOString(),
      });
      return await jsonRoute(ctx.res, 503, {
        error: {
          code: "MODEL_UNAVAILABLE",
          message: toUserFacingLlmErrorMessage(error),
          retryable: true,
          jobId: job.jobId,
        },
      });
    }
    await ctx.sessions.save(result.session);
    if (idempotencyKey && requestHash) {
      await ctx.idempotency.save({
        key: idempotencyKey,
        sessionId: ctx.session.sessionId,
        route: ctx.url.pathname,
        requestHash,
        response: result.response,
        status: 200,
        createdAt: new Date().toISOString(),
        expiresAt: buildIdempotencyExpiry(ctx.config.idempotencyTtlHours),
      });
    }
    return await jsonRoute(ctx.res, 200, result.response);
  }

  if (ctx.req.method === "GET" && ctx.url.pathname === "/api/v1/agent/task-state") {
    return await jsonRoute(ctx.res, 200, buildTaskStateRoutePayload(ctx.session));
  }

  if (ctx.req.method === "GET" && ctx.url.pathname === "/api/v1/agent/history") {
    return await jsonRoute(ctx.res, 200, buildChatHistoryRoutePayload(ctx.session));
  }

  return false;
}

function hashRequest(route: string, body: unknown) {
  return crypto.createHash("sha256").update(`${route}:${JSON.stringify(body)}`).digest("hex");
}

function toAgentAction(body: z.infer<typeof agentTurnSchema>) {
  if (body.action === "confirm") {
    return { type: "confirm" } as const;
  }
  if (body.action === "cancel") {
    return { type: "cancel" } as const;
  }
  if (body.optionValue) {
    return { type: "select_option", value: body.optionValue } as const;
  }
  return { type: "message", message: body.message ?? "" } as const;
}
