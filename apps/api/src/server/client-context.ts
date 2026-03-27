import type { IncomingMessage } from "node:http";
import type { StoredSessionState } from "../../../../src/app/session-types.js";

const CLIENT_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export function updateSessionClientContext(
  session: StoredSessionState,
  req: IncomingMessage,
  nowIso = new Date().toISOString(),
) {
  const nextClient = {
    appVersion: readHeader(req, "x-opencal-app-version"),
    platform: readHeader(req, "x-opencal-platform"),
    userAgent: readHeader(req, "user-agent"),
    lastSeenAt: nowIso,
  };

  if (!shouldPersistClientContext(session.client, nextClient, nowIso)) {
    return session;
  }

  return {
    ...session,
    updatedAt: nowIso,
    client: nextClient,
  };
}

function shouldPersistClientContext(
  current: StoredSessionState["client"],
  next: NonNullable<StoredSessionState["client"]>,
  nowIso: string,
) {
  if (!current) {
    return true;
  }

  if (
    current.appVersion !== next.appVersion ||
    current.platform !== next.platform ||
    current.userAgent !== next.userAgent
  ) {
    return true;
  }

  const elapsedMs = new Date(nowIso).getTime() - new Date(current.lastSeenAt).getTime();
  return elapsedMs >= CLIENT_TOUCH_INTERVAL_MS;
}

function readHeader(req: IncomingMessage, name: string) {
  const value = req.headers[name];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
