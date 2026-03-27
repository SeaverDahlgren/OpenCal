import http from "node:http";
import crypto from "node:crypto";
import path from "node:path";
import { URL } from "node:url";
import { loadConfig } from "../../../src/config/env.js";
import { appendDebugLog } from "../../../src/memory/logs.js";
import { ensureWorkspace, loadWorkspaceFiles } from "../../../src/memory/workspace.js";
import { GoogleCalendarService } from "../../../src/integrations/google/calendar.js";
import { ApiAuthService } from "./auth/service.js";
import { createRuntimeStores } from "./bootstrap/runtime.js";
import { handleAdminRoute } from "./routes/admin.js";
import { handleAgentRoute } from "./routes/agent.js";
import { handleAuthRoute } from "./routes/auth.js";
import { handleCalendarRoute } from "./routes/calendar.js";
import { handleSessionRoute } from "./routes/session.js";
import { handleSettingsRoute } from "./routes/settings.js";
import {
  applySecurityHeaders,
  InvalidJsonBodyError,
  jsonError,
  jsonRoute,
  readBearerToken,
  RequestTooLargeError,
} from "./server/http.js";
import { buildReadyPayload } from "./server/health.js";
import { InMemoryRateLimiter } from "./server/rate-limit.js";
import { closeServer, registerAbortOnSignals } from "./server/shutdown.js";
import { applyServerTimeouts } from "./server/timeouts.js";
import { updateSessionClientContext } from "./server/client-context.js";
import { isSupportedAppVersion, readClientAppVersion } from "./server/versioning.js";

const config = loadConfig(process.cwd());
const { sessions, profiles, tokens, audit, idempotency, jobs } = createRuntimeStores(config);
const auth = new ApiAuthService(config, sessions, tokens, audit);
const rateLimiter = new InMemoryRateLimiter(config.rateLimitWindowMs, config.rateLimitMaxRequests);

const server = http.createServer(async (req, res) => {
  const requestId = crypto.randomUUID();
  res.setHeader("x-request-id", requestId);
  res.setHeader("x-opencal-api-version", config.apiVersion ?? "1.0.0");
  applySecurityHeaders(res, config.appEnv);
  const debugLogPath = path.join(config.rootDir, ".opencal", "logs", `${new Date().toISOString().slice(0, 10)}.log`);

  try {
    await ensureWorkspace(config.rootDir);
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
    await appendDebugLog(debugLogPath, "api.request.start", {
      requestId,
      method: req.method,
      path: url.pathname,
    });

    if (req.method === "GET" && url.pathname === "/api/v1/health/live") {
      const result = await jsonRoute(res, 200, {
        status: "ok",
        service: "opencal-api",
        environment: config.appEnv,
      });
      await appendDebugLog(debugLogPath, "api.request.complete", {
        requestId,
        method: req.method,
        path: url.pathname,
        status: 200,
      });
      return result;
    }

    if (req.method === "GET" && url.pathname === "/api/v1/health/ready") {
      const payload = buildReadyPayload(config, await jobs.list());
      const result = await jsonRoute(res, 200, {
        ...payload,
      });
      await appendDebugLog(debugLogPath, "api.request.complete", {
        requestId,
        method: req.method,
        path: url.pathname,
        status: 200,
      });
      return result;
    }

    if (
      url.pathname.startsWith("/api/v1") &&
      url.pathname !== "/api/v1/auth/google/callback" &&
      !isSupportedAppVersion(readClientAppVersion(req), config.minSupportedAppVersion)
    ) {
      return await jsonError(
        res,
        426,
        "CLIENT_UPGRADE_REQUIRED",
        `App version ${config.minSupportedAppVersion} or newer is required.`,
        false,
      );
    }

    const token = readBearerToken(req);
    const rateLimitKey = token || `${req.socket.remoteAddress ?? "unknown"}:${url.pathname}`;
    const rateLimit = rateLimiter.check(rateLimitKey);
    res.setHeader("x-rate-limit-remaining", String(rateLimit.remaining));
    res.setHeader("x-rate-limit-reset", new Date(rateLimit.resetAt).toISOString());
    if (!rateLimit.allowed) {
      const retryAfterSeconds = Math.max(Math.ceil((rateLimit.resetAt - Date.now()) / 1000), 1);
      res.setHeader("retry-after", String(retryAfterSeconds));
      const limited = await jsonError(
        res,
        429,
        "RATE_LIMITED",
        "Too many requests. Please try again shortly.",
        true,
        { retryAfterSeconds },
      );
      await appendDebugLog(debugLogPath, "api.request.complete", {
        requestId,
        method: req.method,
        path: url.pathname,
        status: 429,
        rateLimited: true,
      });
      return limited;
    }

    const adminHandled = await handleAdminRoute({
      req,
      res,
      url,
      config,
      auth,
      sessions,
      profiles,
      audit,
      idempotency,
      jobs,
    });
    if (adminHandled !== false) {
      await appendDebugLog(debugLogPath, "api.request.complete", {
        requestId,
        method: req.method,
        path: url.pathname,
        status: res.statusCode,
      });
      return;
    }

    const publicHandled = await handleAuthRoute({
      req,
      res,
      url,
      config,
      auth,
      sessions,
      profiles,
      audit,
      idempotency,
      jobs,
    });
    if (publicHandled !== false) {
      await appendDebugLog(debugLogPath, "api.request.complete", {
        requestId,
        method: req.method,
        path: url.pathname,
        status: res.statusCode,
      });
      return;
    }

    if (!token) {
      return await jsonError(res, 401, "UNAUTHORIZED", "Missing bearer token.", false);
    }

    let session = await sessions.loadByToken(token);
    if (!session) {
      return await jsonError(res, 401, "SESSION_EXPIRED", "Session is invalid or expired.", false);
    }
    const touchedSession = updateSessionClientContext(session, req, config.sessionTtlDays);
    if (touchedSession !== session) {
      await sessions.save(touchedSession);
      session = touchedSession;
    }

    const workspace = await loadWorkspaceFiles(config.rootDir, new Date().toISOString().slice(0, 10));
    const profile = await profiles.loadOrCreate(session.user, workspace.user);

    const sessionHandled = await handleSessionRoute({
      req,
      res,
      url,
      config,
      auth,
      sessions,
      profiles,
      audit,
      idempotency,
      jobs,
      session,
      profile,
    });
    if (sessionHandled !== false) {
      await appendDebugLog(debugLogPath, "api.request.complete", {
        requestId,
        method: req.method,
        path: url.pathname,
        status: res.statusCode,
        sessionId: session.sessionId,
      });
      return;
    }

    const googleClients = await auth.loadAuthorizedGoogleClients(session.user.email);
    if (!googleClients) {
      return await jsonError(res, 401, "GOOGLE_AUTH_REQUIRED", "Google authorization is required.", false);
    }
    const authedContext = {
      req,
      res,
      url,
      config,
      auth,
      sessions,
      profiles,
      audit,
      idempotency,
      jobs,
      session,
      profile,
      googleClients,
      workspace,
      calendarService: new GoogleCalendarService(googleClients.calendar),
    };

    const calendarHandled = await handleCalendarRoute(authedContext);
    if (calendarHandled !== false) {
      await appendDebugLog(debugLogPath, "api.request.complete", {
        requestId,
        method: req.method,
        path: url.pathname,
        status: res.statusCode,
        sessionId: session.sessionId,
        userEmail: session.user.email,
      });
      return;
    }

    const settingsHandled = await handleSettingsRoute({
      ...authedContext,
    });
    if (settingsHandled !== false) {
      await appendDebugLog(debugLogPath, "api.request.complete", {
        requestId,
        method: req.method,
        path: url.pathname,
        status: res.statusCode,
        sessionId: session.sessionId,
        userEmail: session.user.email,
      });
      return;
    }

    const agentHandled = await handleAgentRoute(authedContext);
    if (agentHandled !== false) {
      await appendDebugLog(debugLogPath, "api.request.complete", {
        requestId,
        method: req.method,
        path: url.pathname,
        status: res.statusCode,
        sessionId: session.sessionId,
        userEmail: session.user.email,
      });
      return;
    }

    const notFound = await jsonError(res, 404, "NOT_FOUND", "Route not found.", false);
    await appendDebugLog(debugLogPath, "api.request.complete", {
      requestId,
      method: req.method,
      path: url.pathname,
      status: 404,
    });
    return notFound;
  } catch (error) {
    await appendDebugLog(debugLogPath, "api.request.error", {
      requestId,
      method: req.method,
      path: req.url,
      error: error instanceof Error ? error.message : String(error),
    });
    if (error instanceof RequestTooLargeError) {
      return await jsonError(
        res,
        413,
        "REQUEST_TOO_LARGE",
        `Request body exceeded ${error.maxBytes} bytes.`,
        false,
      );
    }
    if (error instanceof InvalidJsonBodyError) {
      return await jsonError(res, 400, "VALIDATION_ERROR", error.message, false);
    }
    return await jsonError(
      res,
      500,
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Unexpected server error.",
      false,
    );
  }
});
applyServerTimeouts(server, config);

const port = Number(process.env.API_PORT ?? 8787);
server.listen(port, () => {
  console.log(`openCal API listening on http://127.0.0.1:${port}`);
});

const shutdownController = new AbortController();
registerAbortOnSignals(shutdownController, (signal) => {
  console.log(`Stopping OpenCal API on ${signal}...`);
  void closeServer(server)
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    })
    .finally(() => {
      process.exit();
    });
});
