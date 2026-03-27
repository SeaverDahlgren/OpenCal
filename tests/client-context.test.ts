import { describe, expect, it } from "vitest";
import { updateSessionClientContext } from "../apps/api/src/server/client-context.js";
import type { StoredSessionState } from "../src/app/session-types.js";

describe("session client context", () => {
  it("captures app version, platform, and last seen on first touch", () => {
    const session = updateSessionClientContext(
      createSession(),
      createRequest({
        "x-opencal-app-version": "1.2.3",
        "x-opencal-platform": "ios",
        "user-agent": "ExpoGo/1",
      }),
      14,
      "2026-03-26T20:00:00.000Z",
    );

    expect(session.client).toEqual({
      appVersion: "1.2.3",
      platform: "ios",
      userAgent: "ExpoGo/1",
      lastSeenAt: "2026-03-26T20:00:00.000Z",
    });
  });

  it("avoids rewriting unchanged client context too frequently", () => {
    const current = createSession({
      updatedAt: "2026-03-26T20:00:00.000Z",
      client: {
        appVersion: "1.2.3",
        platform: "ios",
        userAgent: "ExpoGo/1",
        lastSeenAt: "2026-03-26T20:00:00.000Z",
      },
    });

    const untouched = updateSessionClientContext(
      current,
      createRequest({
        "x-opencal-app-version": "1.2.3",
        "x-opencal-platform": "ios",
        "user-agent": "ExpoGo/1",
      }),
      14,
      "2026-03-26T20:03:00.000Z",
    );

    expect(untouched).toBe(current);
  });

  it("extends expiry when the session is close to timing out", () => {
    const current = createSession({
      expiresAt: "2026-03-27T10:00:00.000Z",
      client: {
        appVersion: "1.2.3",
        platform: "ios",
        userAgent: "ExpoGo/1",
        lastSeenAt: "2026-03-26T20:00:00.000Z",
      },
    });

    const touched = updateSessionClientContext(
      current,
      createRequest({
        "x-opencal-app-version": "1.2.3",
        "x-opencal-platform": "ios",
        "user-agent": "ExpoGo/1",
      }),
      14,
      "2026-03-26T20:03:00.000Z",
    );

    expect(touched).not.toBe(current);
    expect(touched.expiresAt).toBe("2026-04-09T20:03:00.000Z");
  });
});

function createRequest(headers: Record<string, string>) {
  return { headers } as never;
}

function createSession(overrides: Partial<StoredSessionState> = {}): StoredSessionState {
  return {
    sessionId: "sess-123",
    token: "token-123",
    tokenHash: "hash-123",
    expiresAt: "2026-04-01T00:00:00.000Z",
    user: {
      name: "Avery",
      email: "avery@example.com",
    },
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    toolResultVerbosity: "compact",
    createdAt: "2026-03-26T19:00:00.000Z",
    updatedAt: "2026-03-26T19:00:00.000Z",
    messages: [],
    taskState: null,
    pendingConfirmation: null,
    ...overrides,
  };
}
