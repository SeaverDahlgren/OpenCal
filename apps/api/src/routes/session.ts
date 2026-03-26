import { jsonRoute } from "../server/http.js";
import type { SessionRouteContext } from "./types.js";
import { buildSessionRoutePayload } from "./utils.js";

export async function handleSessionRoute(ctx: SessionRouteContext) {
  if (ctx.req.method === "GET" && ctx.url.pathname === "/api/v1/session") {
    return await jsonRoute(ctx.res, 200, buildSessionRoutePayload(ctx.session));
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
