import { jsonRoute } from "../server/http.js";
import type { SessionRouteContext } from "./types.js";
import { buildSessionRoutePayload } from "./utils.js";

export async function handleSessionRoute(ctx: SessionRouteContext) {
  if (ctx.req.method === "GET" && ctx.url.pathname === "/api/v1/session") {
    return await jsonRoute(ctx.res, 200, buildSessionRoutePayload(ctx.session, ctx.profile));
  }

  if (ctx.req.method === "POST" && ctx.url.pathname === "/api/v1/session/reset") {
    const reset = await ctx.sessions.resetSession(ctx.session.sessionId);
    return await jsonRoute(ctx.res, 200, {
      ok: true,
      sessionId: reset?.sessionId ?? ctx.session.sessionId,
    });
  }

  if (ctx.req.method === "POST" && ctx.url.pathname === "/api/v1/session/revoke") {
    const revoked = await ctx.sessions.deleteSession(ctx.session.sessionId);
    return await jsonRoute(ctx.res, 200, {
      ok: true,
      sessionId: revoked?.sessionId ?? ctx.session.sessionId,
    });
  }

  return false;
}
