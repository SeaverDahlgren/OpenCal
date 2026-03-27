import { z } from "zod";
import { buildMobileErrorUrl, buildMobileReturnUrl, decodeAuthState, encodeAuthState } from "../auth/state.js";
import { BetaAccessDeniedError } from "../auth/service.js";
import { jsonError, jsonRoute, readJsonBody } from "../server/http.js";
import type { PublicRouteContext } from "./types.js";

const authStartSchema = z.object({
  returnTo: z.string().min(1).optional(),
});

export async function handleAuthRoute(ctx: PublicRouteContext) {
  if (ctx.req.method === "POST" && ctx.url.pathname === "/api/v1/auth/google/start") {
    const body = authStartSchema.parse(await readJsonBody<{ returnTo?: string }>(ctx.req, ctx.config.maxRequestBodyBytes));
    return await jsonRoute(ctx.res, 200, {
      authUrl: ctx.auth.buildAuthUrl(encodeAuthState(ctx.config, { returnTo: body.returnTo })),
    });
  }

  if (ctx.req.method === "POST" && ctx.url.pathname === "/api/v1/auth/google/reuse") {
    let session;
    try {
      session = await ctx.auth.reuseAuthorizedSession();
    } catch (error) {
      if (error instanceof BetaAccessDeniedError) {
        return await jsonError(
          ctx.res,
          403,
          "BETA_ACCESS_DENIED",
          "This Google account is not enabled for the OpenCal beta.",
          false,
        );
      }
      throw error;
    }
    if (!session) {
      return await jsonError(
        ctx.res,
        401,
        "GOOGLE_AUTH_REQUIRED",
        "No existing Google authorization is available.",
        false,
      );
    }

    return await jsonRoute(ctx.res, 200, {
      sessionToken: session.token,
      sessionId: session.sessionId,
      user: session.user,
    });
  }

  if (ctx.req.method === "GET" && ctx.url.pathname === "/api/v1/auth/google/callback") {
    const code = ctx.url.searchParams.get("code");
    if (!code) {
      return await jsonError(ctx.res, 400, "VALIDATION_ERROR", "Missing OAuth code.", false);
    }
    const state = decodeAuthState(ctx.config, ctx.url.searchParams.get("state"));
    let session;
    try {
      session = await ctx.auth.completeAuthorization(code);
    } catch (error) {
      if (error instanceof BetaAccessDeniedError) {
        const returnUrl = buildMobileErrorUrl(ctx.config, state.returnTo, {
          code: "BETA_ACCESS_DENIED",
          message: "This Google account is not enabled for the OpenCal beta.",
        });
        if (returnUrl) {
          ctx.res.writeHead(302, { location: returnUrl });
          ctx.res.end();
          return;
        }
        return await jsonError(
          ctx.res,
          403,
          "BETA_ACCESS_DENIED",
          "This Google account is not enabled for the OpenCal beta.",
          false,
        );
      }
      throw error;
    }
    const returnUrl = buildMobileReturnUrl(ctx.config, state.returnTo, session);
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
