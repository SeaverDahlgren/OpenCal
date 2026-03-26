import { z } from "zod";
import { createLlmProvider } from "../../../../src/llm/factory.js";
import { buildToolRegistry } from "../../../../src/tools/registry.js";
import { runAgentSessionTurn } from "../../../../src/app/session-runtime.js";
import { buildSkillCatalogAndManifests } from "../skills.js";
import { jsonError, jsonRoute, readJsonBody } from "../server/http.js";
import type { AuthedRouteContext } from "./types.js";

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
    const body = agentTurnSchema.safeParse(await readJsonBody(ctx.req));
    if (!body.success) {
      return await jsonError(ctx.res, 400, "VALIDATION_ERROR", "A message or action is required.", false);
    }
    const runtimeConfig = configForSession(ctx.config, ctx.session);
    const provider = createLlmProvider(runtimeConfig);
    const tools = buildToolRegistry(ctx.googleClients);
    const skills = await buildSkillCatalogAndManifests(ctx.config.rootDir);
    const result = await runAgentSessionTurn(
      {
        config: runtimeConfig,
        provider,
        tools,
        workspace: ctx.workspace,
        timezone: currentTimezone(ctx.workspace.user),
        skillManifests: skills.manifests,
        skillsCatalog: skills.catalog,
      },
      ctx.session,
      toAgentAction(body.data),
    );
    await ctx.sessions.save(result.session);
    return await jsonRoute(ctx.res, 200, result.response);
  }

  if (ctx.req.method === "GET" && ctx.url.pathname === "/api/v1/agent/task-state") {
    return await jsonRoute(ctx.res, 200, {
      taskState: ctx.session.taskState
        ? {
            taskId: ctx.session.taskState.taskId,
            summary: ctx.session.taskState.taskSummary,
            status: ctx.session.taskState.mode,
            activeSubgoal: ctx.session.taskState.activeSubgoalId,
            hasBlockedPrompt: Boolean(ctx.session.taskState.awaitingUserResponse),
          }
        : null,
      clarification: ctx.session.taskState?.awaitingUserResponse
        ? {
            type: ctx.session.taskState.awaitingUserResponse.options?.length ? "choice" : "freeform",
            prompt: ctx.session.taskState.awaitingUserResponse.prompt,
            options: (ctx.session.taskState.awaitingUserResponse.options ?? []).map((option, index) => ({
              id: String(index + 1),
              label: option.summary,
              value: option.value,
            })),
          }
        : null,
      confirmation: ctx.session.pendingConfirmation
        ? {
            type: "protected_action",
            prompt: `Confirm ${ctx.session.pendingConfirmation.toolName.replace(/_/g, " ")}.`,
            actionLabel: "Confirm",
            cancelLabel: "Cancel",
            payloadPreview: {
              kind: ctx.session.pendingConfirmation.toolName,
              raw: ctx.session.pendingConfirmation.arguments,
            },
          }
        : null,
    });
  }

  return false;
}

function configForSession(base: AuthedRouteContext["config"], session: AuthedRouteContext["session"]) {
  return {
    ...base,
    llmProvider: session.provider,
    toolResultVerbosity: session.toolResultVerbosity,
    geminiModel: session.provider === "gemini" ? session.model : base.geminiModel,
    groqModel: session.provider === "groq" ? session.model : base.groqModel,
  };
}

function currentTimezone(userMarkdown = "") {
  return userMarkdown.match(/timezone:\s*([A-Za-z_\/]+)/i)?.[1] ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
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
