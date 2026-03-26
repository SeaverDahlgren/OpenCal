import fs from "node:fs/promises";
import { z } from "zod";
import { mapSettingsView, updateUserMarkdown } from "../dto/mappers.js";
import { jsonRoute, readJsonBody } from "../server/http.js";
import type { SessionRouteContext } from "./types.js";

const settingsPatchSchema = z.object({
  preferences: z
    .object({
      timezone: z.string().optional(),
      workStart: z.string().optional(),
      workEnd: z.string().optional(),
      meetingPreference: z.string().optional(),
      assistantNotes: z.string().optional(),
    })
    .partial()
    .optional(),
  advanced: z
    .object({
      provider: z.string().optional(),
      model: z.string().optional(),
      toolResultVerbosity: z.enum(["compact", "verbose"]).optional(),
    })
    .partial()
    .optional(),
});

export async function handleSettingsRoute(ctx: SessionRouteContext & { userMarkdown: string }) {
  if (ctx.req.method === "GET" && ctx.url.pathname === "/api/v1/settings") {
    return await jsonRoute(
      ctx.res,
      200,
      mapSettingsView({
        userMarkdown: ctx.userMarkdown,
        provider: ctx.session.provider,
        model: ctx.session.model,
        verbosity: ctx.session.toolResultVerbosity,
        sessionId: ctx.session.sessionId,
        user: ctx.session.user,
      }),
    );
  }

  if (ctx.req.method === "PATCH" && ctx.url.pathname === "/api/v1/settings") {
    const body = settingsPatchSchema.parse(await readJsonBody(ctx.req));
    const nextMarkdown = updateUserMarkdown(ctx.userMarkdown, body.preferences ?? {});
    await fs.writeFile(`${ctx.config.rootDir}/USER.md`, nextMarkdown, "utf8");
    const updatedSession = {
      ...ctx.session,
      provider: body.advanced?.provider ?? ctx.session.provider,
      model: body.advanced?.model ?? ctx.session.model,
      toolResultVerbosity: body.advanced?.toolResultVerbosity ?? ctx.session.toolResultVerbosity,
    };
    await ctx.sessions.save(updatedSession);
    return await jsonRoute(
      ctx.res,
      200,
      mapSettingsView({
        userMarkdown: nextMarkdown,
        provider: updatedSession.provider,
        model: updatedSession.model,
        verbosity: updatedSession.toolResultVerbosity,
        sessionId: updatedSession.sessionId,
        user: updatedSession.user,
      }),
    );
  }

  return false;
}
