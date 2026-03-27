import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AuditStore } from "../apps/api/src/audit/store.js";
import { JobStore } from "../apps/api/src/jobs/store.js";
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
    await store.save({
      ...first,
      client: {
        appVersion: "1.2.3",
        platform: "ios",
        userAgent: "ExpoGo/1",
        lastSeenAt: "2026-03-26T20:00:00.000Z",
      },
    });
    const second = await store.createOrReplaceSession({
      name: "Jordan",
      email: "jordan@example.com",
    });

    const sessions = await store.listSessions();

    expect(sessions).toHaveLength(2);
    expect(await store.loadBySessionId(first.sessionId)).toMatchObject({
      user: { email: "avery@example.com" },
      client: { appVersion: "1.2.3", platform: "ios" },
    });
    expect(await store.loadBySessionId(second.sessionId)).toMatchObject({ user: { email: "jordan@example.com" } });
  });

  it("resets and revokes sessions through the admin route", async () => {
    const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-admin-session-store-"));
    createdDirs.push(privateDir);
    const store = new SessionStore(createConfig(privateDir));
    const audit = new AuditStore(createConfig(privateDir));
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
      audit,
      idempotency: {} as never,
      jobs: new JobStore(createConfig(privateDir)),
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
      audit,
      idempotency: {} as never,
      jobs: new JobStore(createConfig(privateDir)),
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

  it("lists and retries queued jobs through the admin route", async () => {
    const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-admin-job-store-"));
    createdDirs.push(privateDir);
    const jobs = new JobStore(createConfig(privateDir));
    const audit = new AuditStore(createConfig(privateDir));
    const queued = await jobs.enqueue({
      kind: "agent_turn_retry",
      payload: {
        sessionId: "sess-123",
        action: { type: "message", message: "retry this" },
      },
      maxAttempts: 3,
      runAt: "2030-03-26T00:00:00.000Z",
    });

    const list = createResponse();
    await handleAdminRoute({
      req: createRequest("GET", "/api/v1/admin/job?status=pending"),
      res: list.res,
      url: new URL("http://127.0.0.1:8787/api/v1/admin/job?status=pending"),
      config: createConfig(privateDir),
      auth: {} as never,
      sessions: new SessionStore(createConfig(privateDir)),
      profiles: {} as never,
      audit,
      idempotency: {} as never,
      jobs,
    });

    expect(JSON.parse(list.body())).toMatchObject({
      jobs: [
        {
          jobId: queued.jobId,
          status: "pending",
          sessionId: "sess-123",
        },
      ],
    });

    const retry = createResponse();
    await handleAdminRoute({
      req: createRequest("POST", `/api/v1/admin/job/retry?jobId=${queued.jobId}`),
      res: retry.res,
      url: new URL(`http://127.0.0.1:8787/api/v1/admin/job/retry?jobId=${queued.jobId}`),
      config: createConfig(privateDir),
      auth: {} as never,
      sessions: new SessionStore(createConfig(privateDir)),
      profiles: {} as never,
      audit,
      idempotency: {} as never,
      jobs,
    });

    expect(JSON.parse(retry.body())).toMatchObject({
      ok: true,
      action: "retry",
      job: {
        jobId: queued.jobId,
        status: "pending",
      },
    });
  });

  it("surfaces exhausted jobs as terminal in admin summaries", async () => {
    const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-admin-job-store-"));
    createdDirs.push(privateDir);
    const jobs = new JobStore(createConfig(privateDir));
    const audit = new AuditStore(createConfig(privateDir));
    const queued = await jobs.enqueue({
      kind: "agent_turn_retry",
      payload: {
        sessionId: "sess-999",
        action: { type: "message", message: "retry this" },
      },
      maxAttempts: 1,
      runAt: "2000-03-26T00:00:00.000Z",
    });
    await jobs.reserveNext();
    await jobs.fail(queued.jobId, "permanent failure");

    const list = createResponse();
    await handleAdminRoute({
      req: createRequest("GET", "/api/v1/admin/job?status=exhausted"),
      res: list.res,
      url: new URL("http://127.0.0.1:8787/api/v1/admin/job?status=exhausted"),
      config: createConfig(privateDir),
      auth: {} as never,
      sessions: new SessionStore(createConfig(privateDir)),
      profiles: {} as never,
      audit,
      idempotency: {} as never,
      jobs,
    });

    expect(JSON.parse(list.body())).toMatchObject({
      jobs: [
        {
          jobId: queued.jobId,
          status: "exhausted",
          isTerminal: true,
          sessionId: "sess-999",
        },
      ],
    });
  });

  it("lists recent audit events through the admin route", async () => {
    const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-admin-audit-store-"));
    createdDirs.push(privateDir);
    const audit = new AuditStore(createConfig(privateDir));
    await audit.append({
      type: "auth.google.completed",
      sessionId: "sess-1",
      userEmail: "avery@example.com",
      metadata: { appEnv: "development" },
    });
    await audit.append({
      type: "admin.job.retry",
      sessionId: "sess-2",
      metadata: { jobId: "job-2" },
    });

    const list = createResponse();
    await handleAdminRoute({
      req: createRequest("GET", "/api/v1/admin/audit?email=avery@example.com"),
      res: list.res,
      url: new URL("http://127.0.0.1:8787/api/v1/admin/audit?email=avery@example.com"),
      config: createConfig(privateDir),
      auth: {} as never,
      sessions: new SessionStore(createConfig(privateDir)),
      profiles: {} as never,
      audit,
      idempotency: {} as never,
      jobs: new JobStore(createConfig(privateDir)),
    });

    expect(JSON.parse(list.body())).toMatchObject({
      events: [
        {
          type: "auth.google.completed",
          sessionId: "sess-1",
          userEmail: "avery@example.com",
        },
      ],
    });
  });
});

function createConfig(privateDir: string): AppConfig {
  return {
    appEnv: "development",
    storageBackend: "file",
    jobBackend: "file",
    llmProvider: "groq",
    toolResultVerbosity: "compact",
    geminiApiKey: undefined,
    groqApiKey: "test-key",
    openAiApiKey: undefined,
    adminApiKey: "admin-secret",
    stateEncryptionKey: undefined,
    apiVersion: "1.0.0",
    minSupportedAppVersion: undefined,
    allowedReturnToPrefixes: [],
    databaseUrl: undefined,
    redisUrl: undefined,
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
    workerPollIntervalMs: 5000,
    rateLimitWindowMs: 60000,
    rateLimitMaxRequests: 120,
    maxRequestBodyBytes: 1024 * 1024,
    idempotencyMaxRecords: 5000,
    jobRetentionDays: 14,
    auditMaxEvents: 1000,
    apiRequestTimeoutMs: 30000,
    apiHeadersTimeoutMs: 30000,
    apiKeepAliveTimeoutMs: 5000,
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
