import { jsonRoute } from "../server/http.js";
import type { SessionRouteContext } from "./types.js";

export async function handleSessionRoute(ctx: SessionRouteContext) {
  if (ctx.req.method === "GET" && ctx.url.pathname === "/api/v1/session") {
    return await jsonRoute(ctx.res, 200, {
      session: {
        sessionId: ctx.session.sessionId,
        status: "authenticated",
        user: ctx.session.user,
        timezone: currentTimezone(),
        hasBlockedTask: Boolean(ctx.session.taskState?.awaitingUserResponse || ctx.session.pendingConfirmation),
        activeTaskSummary: ctx.session.taskState?.taskSummary ?? "",
      },
    });
  }

  if (ctx.req.method === "POST" && ctx.url.pathname === "/api/v1/session/reset") {
    const reset = await ctx.sessions.resetCurrentSession();
    return await jsonRoute(ctx.res, 200, {
      ok: true,
      sessionId: reset?.sessionId ?? ctx.session.sessionId,
    });
  }

  return false;
}

function currentTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
