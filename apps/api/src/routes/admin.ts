import { jsonError, jsonRoute, readAdminKey } from "../server/http.js";
import type { PublicRouteContext } from "./types.js";

export async function handleAdminRoute(ctx: PublicRouteContext) {
  if (!ctx.url.pathname.startsWith("/api/v1/admin/session") && !ctx.url.pathname.startsWith("/api/v1/admin/job")) {
    return false;
  }

  if (!ctx.config.adminApiKey) {
    return await jsonError(ctx.res, 403, "ADMIN_DISABLED", "Admin API is not enabled.", false);
  }

  if (readAdminKey(ctx.req) !== ctx.config.adminApiKey) {
    return await jsonError(ctx.res, 401, "UNAUTHORIZED", "Missing or invalid admin key.", false);
  }

  if (ctx.req.method === "GET" && ctx.url.pathname === "/api/v1/admin/session") {
    const sessionId = ctx.url.searchParams.get("sessionId");
    const email = ctx.url.searchParams.get("email");

    if (!sessionId && !email) {
      const sessions = await ctx.sessions.listSessions();
      return await jsonRoute(ctx.res, 200, {
        sessions: sessions.map(summarizeSession),
      });
    }

    const session = await resolveTargetSession(ctx, sessionId, email);

    if (!session) {
      return await jsonError(ctx.res, 404, "NOT_FOUND", "Session not found.", false);
    }

    return await jsonRoute(ctx.res, 200, {
      session: summarizeSession(session),
    });
  }

  if (ctx.req.method === "GET" && ctx.url.pathname === "/api/v1/admin/job") {
    const jobId = ctx.url.searchParams.get("jobId");
    const sessionId = ctx.url.searchParams.get("sessionId");
    const status = ctx.url.searchParams.get("status");

    if (jobId) {
      const job = await ctx.jobs.load(jobId);
      if (!job) {
        return await jsonError(ctx.res, 404, "NOT_FOUND", "Job not found.", false);
      }
      return await jsonRoute(ctx.res, 200, {
        job: summarizeJob(job),
      });
    }

    const jobs = (await ctx.jobs.list()).filter((job) => {
      if (sessionId && job.payload.sessionId !== sessionId) {
        return false;
      }
      if (status && job.status !== status) {
        return false;
      }
      return true;
    });

    return await jsonRoute(ctx.res, 200, {
      jobs: jobs.map(summarizeJob),
    });
  }

  if (ctx.req.method === "POST" && ctx.url.pathname === "/api/v1/admin/session/reset") {
    const session = await resolveTargetSession(
      ctx,
      ctx.url.searchParams.get("sessionId"),
      ctx.url.searchParams.get("email"),
    );
    if (!session) {
      return await jsonError(ctx.res, 404, "NOT_FOUND", "Session not found.", false);
    }

    const reset = await ctx.sessions.resetSession(session.sessionId);
    return await jsonRoute(ctx.res, 200, {
      ok: true,
      action: "reset",
      session: summarizeSession(reset),
    });
  }

  if (ctx.req.method === "POST" && ctx.url.pathname === "/api/v1/admin/session/revoke") {
    const session = await resolveTargetSession(
      ctx,
      ctx.url.searchParams.get("sessionId"),
      ctx.url.searchParams.get("email"),
    );
    if (!session) {
      return await jsonError(ctx.res, 404, "NOT_FOUND", "Session not found.", false);
    }

    const revoked = await ctx.sessions.deleteSession(session.sessionId);
    return await jsonRoute(ctx.res, 200, {
      ok: true,
      action: "revoke",
      session: summarizeSession(revoked),
    });
  }

  if (ctx.req.method === "POST" && ctx.url.pathname === "/api/v1/admin/job/retry") {
    const jobId = ctx.url.searchParams.get("jobId");
    if (!jobId) {
      return await jsonError(ctx.res, 400, "VALIDATION_ERROR", "jobId is required.", false);
    }

    const retried = await ctx.jobs.retry(jobId);
    if (!retried) {
      return await jsonError(ctx.res, 404, "NOT_FOUND", "Job not found.", false);
    }

    return await jsonRoute(ctx.res, 200, {
      ok: true,
      action: "retry",
      job: summarizeJob(retried),
    });
  }

  return await jsonError(ctx.res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.", false);
}

function summarizeSession(session: Awaited<ReturnType<PublicRouteContext["sessions"]["getCurrentSession"]>> | null) {
  if (!session) {
    return null;
  }

  return {
    sessionId: session.sessionId,
    user: session.user,
    provider: session.provider,
    model: session.model,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    expiresAt: session.expiresAt,
    hasMessages: session.messages.length > 0,
    messageCount: session.messages.length,
    hasTaskState: Boolean(session.taskState),
    hasPendingConfirmation: Boolean(session.pendingConfirmation),
  };
}

function summarizeJob(job: Awaited<ReturnType<PublicRouteContext["jobs"]["load"]>> | null) {
  if (!job) {
    return null;
  }

  return {
    jobId: job.jobId,
    kind: job.kind,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    runAt: job.runAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    lastError: job.lastError,
    sessionId: job.payload.sessionId,
    hasResult: Boolean(job.result),
  };
}

async function resolveTargetSession(ctx: PublicRouteContext, sessionId: string | null, email: string | null) {
  return sessionId
    ? await ctx.sessions.loadBySessionId(sessionId)
    : email
      ? await ctx.sessions.getByUserEmail(email)
      : null;
}
