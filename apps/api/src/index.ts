import fs from "node:fs/promises";
import http from "node:http";
import { URL } from "node:url";
import { loadConfig, type AppConfig } from "../../../src/config/env.js";
import { loadWorkspaceFiles, ensureWorkspace } from "../../../src/memory/workspace.js";
import { buildSkillCatalogAndManifests } from "./skills.js";
import { ApiAuthService } from "./auth/service.js";
import { buildMobileReturnUrl, decodeAuthState, encodeAuthState } from "./auth/state.js";
import { SessionStore } from "./sessions/store.js";
import { createLlmProvider } from "../../../src/llm/factory.js";
import { buildToolRegistry } from "../../../src/tools/registry.js";
import { runAgentSessionTurn } from "../../../src/app/session-runtime.js";
import { GoogleCalendarService } from "../../../src/integrations/google/calendar.js";
import { mapCalendarDayView, mapCalendarMonthView, mapSettingsView, mapTodayOverview, updateUserMarkdown } from "./dto/mappers.js";
import type { AgentActionRequest, StoredSessionState } from "../../../src/app/session-types.js";

const config = loadConfig(process.cwd());
const sessions = new SessionStore(config);
const auth = new ApiAuthService(config, sessions);

const server = http.createServer(async (req, res) => {
  try {
    await ensureWorkspace(config.rootDir);
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);

    if (req.method === "POST" && url.pathname === "/api/v1/auth/google/start") {
      const body = (await readJsonBody(req)) as { returnTo?: string };
      return await jsonRoute(res, 200, {
        authUrl: auth.buildAuthUrl(encodeAuthState({ returnTo: body.returnTo })),
      });
    }

    if (req.method === "GET" && url.pathname === "/api/v1/auth/google/callback") {
      const code = url.searchParams.get("code");
      if (!code) {
        return await jsonError(res, 400, "VALIDATION_ERROR", "Missing OAuth code.", false);
      }
      const session = await auth.completeAuthorization(code);
      const state = decodeAuthState(url.searchParams.get("state"));
      const returnUrl = buildMobileReturnUrl(state.returnTo, session);
      if (returnUrl) {
        res.writeHead(302, { location: returnUrl });
        res.end();
        return;
      }
      return await jsonRoute(res, 200, {
        sessionToken: session.token,
        sessionId: session.sessionId,
        user: session.user,
      });
    }

    if (req.method === "GET" && url.pathname === "/api/v1/session") {
      const session = await requireSession(req, res);
      if (!session) {
        return;
      }
      return await jsonRoute(res, 200, {
        session: {
          sessionId: session.sessionId,
          status: "authenticated",
          user: session.user,
          timezone: currentTimezone(),
          hasBlockedTask: Boolean(session.taskState?.awaitingUserResponse || session.pendingConfirmation),
          activeTaskSummary: session.taskState?.taskSummary ?? "",
        },
      });
    }

    if (req.method === "POST" && url.pathname === "/api/v1/session/reset") {
      const session = await requireSession(req, res);
      if (!session) {
        return;
      }
      const reset = await sessions.resetCurrentSession();
      return await jsonRoute(res, 200, {
        ok: true,
        sessionId: reset?.sessionId ?? session.sessionId,
      });
    }

    const session = await requireSession(req, res);
    if (!session) {
      return;
    }

    const googleClients = await auth.loadAuthorizedGoogleClients();
    if (!googleClients) {
      return await jsonError(res, 401, "GOOGLE_AUTH_REQUIRED", "Google authorization is required.", false);
    }

    const workspace = await loadWorkspaceFiles(config.rootDir, new Date().toISOString().slice(0, 10));
    const calendarService = new GoogleCalendarService(googleClients.calendar);

    if (req.method === "GET" && url.pathname === "/api/v1/today") {
      const today = new Date().toISOString().slice(0, 10);
      const events = await calendarService.searchEvents({
        calendarId: "primary",
        timeMin: `${today}T00:00:00`,
        timeMax: `${today}T23:59:59`,
        maxResults: 25,
      });
      return await jsonRoute(res, 200, mapTodayOverview({
        date: today,
        timezone: currentTimezone(workspace.user),
        events,
      }));
    }

    if (req.method === "GET" && url.pathname === "/api/v1/calendar/month") {
      const year = Number(url.searchParams.get("year"));
      const month = Number(url.searchParams.get("month"));
      if (!Number.isInteger(year) || !Number.isInteger(month)) {
        return await jsonError(res, 400, "VALIDATION_ERROR", "year and month are required.", false);
      }
      const start = new Date(Date.UTC(year, month - 1, 1)).toISOString();
      const end = new Date(Date.UTC(year, month, 0, 23, 59, 59)).toISOString();
      const events = await calendarService.searchEvents({
        calendarId: "primary",
        timeMin: start,
        timeMax: end,
        maxResults: 250,
      });
      return await jsonRoute(res, 200, mapCalendarMonthView({
        year,
        month,
        timezone: currentTimezone(workspace.user),
        events,
      }));
    }

    if (req.method === "GET" && url.pathname === "/api/v1/calendar/day") {
      const date = url.searchParams.get("date");
      if (!date) {
        return await jsonError(res, 400, "VALIDATION_ERROR", "date is required.", false);
      }
      const events = await calendarService.searchEvents({
        calendarId: "primary",
        timeMin: `${date}T00:00:00`,
        timeMax: `${date}T23:59:59`,
        maxResults: 100,
      });
      return await jsonRoute(res, 200, mapCalendarDayView({
        date,
        timezone: currentTimezone(workspace.user),
        events,
      }));
    }

    if (req.method === "GET" && url.pathname === "/api/v1/settings") {
      return await jsonRoute(res, 200, mapSettingsView({
        userMarkdown: workspace.user,
        provider: session.provider,
        model: session.model,
        verbosity: session.toolResultVerbosity,
        sessionId: session.sessionId,
        user: session.user,
      }));
    }

    if (req.method === "PATCH" && url.pathname === "/api/v1/settings") {
      const body = await readJsonBody(req);
      const nextMarkdown = updateUserMarkdown(workspace.user, body.preferences ?? {});
      await fs.writeFile(`${config.rootDir}/USER.md`, nextMarkdown, "utf8");
      const updatedSession: StoredSessionState = {
        ...session,
        provider: body.advanced?.provider ?? session.provider,
        model: body.advanced?.model ?? session.model,
        toolResultVerbosity: body.advanced?.toolResultVerbosity ?? session.toolResultVerbosity,
      };
      await sessions.save(updatedSession);
      const refreshed = await loadWorkspaceFiles(config.rootDir, new Date().toISOString().slice(0, 10));
      return await jsonRoute(res, 200, mapSettingsView({
        userMarkdown: refreshed.user,
        provider: updatedSession.provider,
        model: updatedSession.model,
        verbosity: updatedSession.toolResultVerbosity,
        sessionId: updatedSession.sessionId,
        user: updatedSession.user,
      }));
    }

    if (req.method === "POST" && url.pathname === "/api/v1/agent/turn") {
      const body = (await readJsonBody(req)) as {
        message?: string;
        action?: "confirm" | "cancel";
        optionValue?: string;
      };
      const action = toAgentAction(body);
      if (!action) {
        return await jsonError(res, 400, "VALIDATION_ERROR", "A message or action is required.", false);
      }
      const runtimeConfig = configForSession(config, session);
      const provider = createLlmProvider(runtimeConfig);
      const tools = buildToolRegistry(googleClients);
      const skills = await buildSkillCatalogAndManifests(config.rootDir);
      const result = await runAgentSessionTurn(
        {
          config: runtimeConfig,
          provider,
          tools,
          workspace,
          timezone: currentTimezone(workspace.user),
          skillManifests: skills.manifests,
          skillsCatalog: skills.catalog,
        },
        session,
        action,
      );
      await sessions.save(result.session);
      return await jsonRoute(res, 200, result.response);
    }

    if (req.method === "GET" && url.pathname === "/api/v1/agent/task-state") {
      return await jsonRoute(res, 200, {
        taskState: session.taskState
          ? {
              taskId: session.taskState.taskId,
              summary: session.taskState.taskSummary,
              status: session.taskState.mode,
              activeSubgoal: session.taskState.activeSubgoalId,
              hasBlockedPrompt: Boolean(session.taskState.awaitingUserResponse),
            }
          : null,
        clarification: session.taskState?.awaitingUserResponse
          ? {
              type: session.taskState.awaitingUserResponse.options?.length ? "choice" : "freeform",
              prompt: session.taskState.awaitingUserResponse.prompt,
              options: (session.taskState.awaitingUserResponse.options ?? []).map((option, index) => ({
                id: String(index + 1),
                label: option.summary,
                value: option.value,
              })),
            }
          : null,
        confirmation: session.pendingConfirmation
          ? {
              type: "protected_action",
              prompt: `Confirm ${session.pendingConfirmation.toolName.replace(/_/g, " ")}.`,
              actionLabel: "Confirm",
              cancelLabel: "Cancel",
              payloadPreview: {
                kind: session.pendingConfirmation.toolName,
                raw: session.pendingConfirmation.arguments,
              },
            }
          : null,
      });
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

async function requireSession(req: http.IncomingMessage, res: http.ServerResponse) {
  const token = readBearerToken(req);
  if (!token) {
    await jsonError(res, 401, "UNAUTHORIZED", "Missing bearer token.", false);
    return null;
  }

  const session = await sessions.loadByToken(token);
  if (!session) {
    await jsonError(res, 401, "SESSION_EXPIRED", "Session is invalid or expired.", false);
    return null;
  }

  return session;
}

async function readJsonBody(req: http.IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, any>;
}

async function jsonRoute(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function jsonError(
  res: http.ServerResponse,
  status: number,
  code: string,
  message: string,
  retryable: boolean,
) {
  return await jsonRoute(res, status, {
    error: {
      code,
      message,
      retryable,
    },
  });
}

function readBearerToken(req: http.IncomingMessage) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  return header.slice("Bearer ".length);
}

function currentTimezone(userMarkdown = "") {
  return userMarkdown.match(/timezone:\s*([A-Za-z_\/]+)/i)?.[1] ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function configForSession(base: AppConfig, session: StoredSessionState): AppConfig {
  return {
    ...base,
    llmProvider: session.provider,
    toolResultVerbosity: session.toolResultVerbosity,
    geminiModel: session.provider === "gemini" ? session.model : base.geminiModel,
    groqModel: session.provider === "groq" ? session.model : base.groqModel,
  };
}

function toAgentAction(body: { message?: string; action?: string; optionValue?: string }): AgentActionRequest | null {
  if (body.action === "confirm") {
    return { type: "confirm" };
  }
  if (body.action === "cancel") {
    return { type: "cancel" };
  }
  if (body.optionValue) {
    return { type: "select_option", value: body.optionValue };
  }
  if (body.message?.trim()) {
    return { type: "message", message: body.message.trim() };
  }
  return null;
}
