import { z } from "zod";
import { buildMobileReturnUrl, decodeAuthState, encodeAuthState } from "../auth/state.js";
import { jsonError, jsonRoute, readJsonBody } from "../server/http.js";
import type { PublicRouteContext } from "./types.js";

const authStartSchema = z.object({
  returnTo: z.string().min(1).optional(),
});

export async function handleAuthRoute(ctx: PublicRouteContext) {
  if (ctx.req.method === "POST" && ctx.url.pathname === "/api/v1/auth/google/start") {
    const body = authStartSchema.parse(await readJsonBody<{ returnTo?: string }>(ctx.req));
    return await jsonRoute(ctx.res, 200, {
      authUrl: ctx.auth.buildAuthUrl(encodeAuthState({ returnTo: body.returnTo })),
    });
  }

  if (ctx.req.method === "GET" && ctx.url.pathname === "/api/v1/auth/google/callback") {
    const code = ctx.url.searchParams.get("code");
    if (!code) {
      return await jsonError(ctx.res, 400, "VALIDATION_ERROR", "Missing OAuth code.", false);
    }
    const session = await ctx.auth.completeAuthorization(code);
    const state = decodeAuthState(ctx.url.searchParams.get("state"));
    const returnUrl = buildMobileReturnUrl(state.returnTo, session);
    if (returnUrl) {
      ctx.res.writeHead(302, { location: returnUrl });
      ctx.res.end();
      return;
    }
    return await jsonRoute(ctx.res, 200, {
      sessionToken: session.token,
      sessionId: session.sessionId,
      user: session.user,
    });
  }

  return false;
}
