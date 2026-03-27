import type { IncomingMessage } from "node:http";
import type { StoredSessionState } from "../../../../src/app/session-types.js";

const CLIENT_TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const SESSION_RENEW_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export function updateSessionClientContext(
  session: StoredSessionState,
  req: IncomingMessage,
  sessionTtlDays: number,
  nowIso = new Date().toISOString(),
) {
  const nextClient = {
    appVersion: readHeader(req, "x-opencal-app-version"),
    platform: readHeader(req, "x-opencal-platform"),
    userAgent: readHeader(req, "user-agent"),
    lastSeenAt: nowIso,
  };

  const nextExpiry = maybeExtendSessionExpiry(session.expiresAt, sessionTtlDays, nowIso);
  if (!shouldPersistClientContext(session.client, nextClient, nextExpiry !== session.expiresAt, nowIso)) {
    return session;
  }

  return {
    ...session,
    updatedAt: nowIso,
    expiresAt: nextExpiry,
    client: nextClient,
  };
}

function shouldPersistClientContext(
  current: StoredSessionState["client"],
  next: NonNullable<StoredSessionState["client"]>,
  expiryChanged: boolean,
  nowIso: string,
) {
  if (expiryChanged) {
    return true;
  }
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

function maybeExtendSessionExpiry(currentExpiryIso: string, ttlDays: number, nowIso: string) {
  const remainingMs = new Date(currentExpiryIso).getTime() - new Date(nowIso).getTime();
  if (remainingMs > SESSION_RENEW_THRESHOLD_MS) {
    return currentExpiryIso;
  }
  const nextExpiry = new Date(nowIso);
  nextExpiry.setUTCDate(nextExpiry.getUTCDate() + ttlDays);
  return nextExpiry.toISOString();
}

function readHeader(req: IncomingMessage, name: string) {
  const value = req.headers[name];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
