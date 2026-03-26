import { z } from "zod";
import { createLlmProvider } from "../../../../src/llm/factory.js";
import { buildToolRegistry } from "../../../../src/tools/registry.js";
import { runAgentSessionTurn } from "../../../../src/app/session-runtime.js";
import { buildSkillCatalogAndManifests } from "../skills.js";
import { jsonError, jsonRoute, readJsonBody } from "../server/http.js";
import type { AuthedRouteContext } from "./types.js";
import { buildTaskStateRoutePayload, resolveUserTimezone } from "./utils.js";

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
        timezone: resolveUserTimezone(ctx.workspace.user),
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
    return await jsonRoute(ctx.res, 200, buildTaskStateRoutePayload(ctx.session));
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
