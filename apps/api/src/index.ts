import http from "node:http";
import { URL } from "node:url";
import { loadConfig } from "../../../src/config/env.js";
import { ensureWorkspace, loadWorkspaceFiles } from "../../../src/memory/workspace.js";
import { GoogleCalendarService } from "../../../src/integrations/google/calendar.js";
import { ApiAuthService } from "./auth/service.js";
import { handleAgentRoute } from "./routes/agent.js";
import { handleAuthRoute } from "./routes/auth.js";
import { handleCalendarRoute } from "./routes/calendar.js";
import { handleSessionRoute } from "./routes/session.js";
import { handleSettingsRoute } from "./routes/settings.js";
import { jsonError, jsonRoute, readBearerToken } from "./server/http.js";
import { SessionStore } from "./sessions/store.js";

const config = loadConfig(process.cwd());
const sessions = new SessionStore(config);
const auth = new ApiAuthService(config, sessions);

const server = http.createServer(async (req, res) => {
  try {
    await ensureWorkspace(config.rootDir);
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);

    if (req.method === "GET" && url.pathname === "/api/v1/health/live") {
      return await jsonRoute(res, 200, {
        status: "ok",
        service: "opencal-api",
        environment: config.appEnv,
      });
    }

    if (req.method === "GET" && url.pathname === "/api/v1/health/ready") {
      return await jsonRoute(res, 200, {
        status: "ready",
        service: "opencal-api",
        environment: config.appEnv,
      });
    }

    const publicHandled = await handleAuthRoute({
      req,
      res,
      url,
      config,
      auth,
      sessions,
    });
    if (publicHandled !== false) {
      return;
    }

    const token = readBearerToken(req);
    if (!token) {
      return await jsonError(res, 401, "UNAUTHORIZED", "Missing bearer token.", false);
    }

    const session = await sessions.loadByToken(token);
    if (!session) {
      return await jsonError(res, 401, "SESSION_EXPIRED", "Session is invalid or expired.", false);
    }

    const sessionHandled = await handleSessionRoute({
      req,
      res,
      url,
      config,
      auth,
      sessions,
      session,
    });
    if (sessionHandled !== false) {
      return;
    }

    const googleClients = await auth.loadAuthorizedGoogleClients();
    if (!googleClients) {
      return await jsonError(res, 401, "GOOGLE_AUTH_REQUIRED", "Google authorization is required.", false);
    }

    const workspace = await loadWorkspaceFiles(config.rootDir, new Date().toISOString().slice(0, 10));
    const authedContext = {
      req,
      res,
      url,
      config,
      auth,
      sessions,
      session,
      googleClients,
      workspace,
      calendarService: new GoogleCalendarService(googleClients.calendar),
    };

    const calendarHandled = await handleCalendarRoute(authedContext);
    if (calendarHandled !== false) {
      return;
    }

    const settingsHandled = await handleSettingsRoute({
      ...authedContext,
      userMarkdown: workspace.user,
    });
    if (settingsHandled !== false) {
      return;
    }

    const agentHandled = await handleAgentRoute(authedContext);
    if (agentHandled !== false) {
      return;
    }

    return await jsonError(res, 404, "NOT_FOUND", "Route not found.", false);
  } catch (error) {
    return await jsonError(
      res,
      500,
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Unexpected server error.",
      false,
    );
  }
});

const port = Number(process.env.API_PORT ?? 8787);
server.listen(port, () => {
  console.log(`openCal API listening on http://127.0.0.1:${port}`);
});
