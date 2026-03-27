import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { handleAdminRoute } from "../apps/api/src/routes/admin.js";
import { SessionStore } from "../apps/api/src/sessions/store.js";
import type { AppConfig } from "../src/config/env.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("admin-ready session store helpers", () => {
  it("lists sessions and loads them by session id", async () => {
    const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-admin-session-store-"));
    createdDirs.push(privateDir);
    const store = new SessionStore(createConfig(privateDir));
    const first = await store.createOrReplaceSession({
      name: "Avery",
      email: "avery@example.com",
    });
    const second = await store.createOrReplaceSession({
      name: "Jordan",
      email: "jordan@example.com",
    });

    const sessions = await store.listSessions();

    expect(sessions).toHaveLength(2);
    expect(await store.loadBySessionId(first.sessionId)).toMatchObject({ user: { email: "avery@example.com" } });
    expect(await store.loadBySessionId(second.sessionId)).toMatchObject({ user: { email: "jordan@example.com" } });
  });

  it("resets and revokes sessions through the admin route", async () => {
    const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-admin-session-store-"));
    createdDirs.push(privateDir);
    const store = new SessionStore(createConfig(privateDir));
    const session = await store.createOrReplaceSession({
      name: "Avery",
      email: "avery@example.com",
    });
    await store.save({
      ...session,
      messages: [{ role: "user", content: "hello", timestamp: "2026-03-25T00:00:00.000Z" }],
    });

    const reset = createResponse();
    await handleAdminRoute({
      req: createRequest("POST", "/api/v1/admin/session/reset?email=avery@example.com"),
      res: reset.res,
      url: new URL("http://127.0.0.1:8787/api/v1/admin/session/reset?email=avery@example.com"),
      config: createConfig(privateDir),
      auth: {} as never,
      sessions: store,
      profiles: {} as never,
      idempotency: {} as never,
      jobs: {} as never,
    });
    expect(reset.statusCode()).toBe(200);
    expect(JSON.parse(reset.body())).toMatchObject({
      ok: true,
      action: "reset",
      session: {
        sessionId: session.sessionId,
        messageCount: 0,
      },
    });

    const revoke = createResponse();
    await handleAdminRoute({
      req: createRequest("POST", `/api/v1/admin/session/revoke?sessionId=${session.sessionId}`),
      res: revoke.res,
      url: new URL(`http://127.0.0.1:8787/api/v1/admin/session/revoke?sessionId=${session.sessionId}`),
      config: createConfig(privateDir),
      auth: {} as never,
      sessions: store,
      profiles: {} as never,
      idempotency: {} as never,
      jobs: {} as never,
    });
    expect(revoke.statusCode()).toBe(200);
    expect(JSON.parse(revoke.body())).toMatchObject({
      ok: true,
      action: "revoke",
      session: {
        sessionId: session.sessionId,
      },
    });
    expect(await store.loadBySessionId(session.sessionId)).toBeNull();
  });
});

function createConfig(privateDir: string): AppConfig {
  return {
    appEnv: "development",
    llmProvider: "groq",
    toolResultVerbosity: "compact",
    geminiApiKey: undefined,
    groqApiKey: "test-key",
    openAiApiKey: undefined,
    adminApiKey: "admin-secret",
    stateEncryptionKey: undefined,
    googleClientId: "google-client-id",
    googleClientSecret: "google-client-secret",
    googleRedirectUri: "http://127.0.0.1:42813/oauth/callback",
    googleApiRedirectUri: "http://127.0.0.1:8787/api/v1/auth/google/callback",
    contextWindowLimit: 128000,
    maxOutputTokens: 2000,
    compactionThreshold: 0.8,
    sessionTtlDays: 14,
    idempotencyTtlHours: 24,
    jobMaxAttempts: 3,
    jobRetryDelayMs: 30000,
    rateLimitWindowMs: 60000,
    rateLimitMaxRequests: 120,
    openAiModel: "gpt-5-mini",
    geminiModel: "gemini-2.5-flash",
    groqModel: "llama-3.3-70b-versatile",
    rootDir: privateDir,
    privateDir,
  };
}

function createRequest(method: string, url: string) {
  return ({
    method,
    url,
    headers: {
      "x-admin-key": "admin-secret",
    },
  } as unknown) as http.IncomingMessage;
}

function createResponse() {
  const chunks: string[] = [];
  const raw = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    setHeader() {},
    getHeader() {
      return undefined;
    },
    writeHead(status: number, headers: Record<string, string>) {
      this.statusCode = status;
      this.headers = headers;
      return this;
    },
    end(chunk?: string) {
      if (chunk) {
        chunks.push(chunk);
      }
    },
  };
  const res = raw as unknown as http.ServerResponse;

  return {
    res,
    statusCode: () => raw.statusCode,
    body: () => chunks.join(""),
  };
}
