import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { IdempotencyStore, buildIdempotencyExpiry } from "../apps/api/src/idempotency/store.js";
import type { AppConfig } from "../src/config/env.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("idempotency store", () => {
  it("persists and reloads keyed responses", async () => {
    const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-idempotency-store-"));
    createdDirs.push(privateDir);
    const store = new IdempotencyStore(createConfig(privateDir));

    await store.save({
      key: "abc",
      sessionId: "sess-1",
      route: "/api/v1/agent/turn",
      requestHash: "hash-1",
      response: { ok: true },
      status: 200,
      createdAt: "2030-03-26T00:00:00.000Z",
      expiresAt: buildIdempotencyExpiry(24, "2030-03-26T00:00:00.000Z"),
    });

    expect(await store.load("sess-1", "abc")).toMatchObject({
      requestHash: "hash-1",
      response: { ok: true },
    });
  });

  it("prunes oldest active records when the max record cap is exceeded", async () => {
    const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-idempotency-store-"));
    createdDirs.push(privateDir);
    const store = new IdempotencyStore({ ...createConfig(privateDir), idempotencyMaxRecords: 2 });

    await store.save({
      key: "first",
      sessionId: "sess-1",
      route: "/api/v1/agent/turn",
      requestHash: "hash-1",
      response: { ok: true },
      status: 200,
      createdAt: "2030-03-26T00:00:00.000Z",
      expiresAt: "2030-03-27T00:00:00.000Z",
    });
    await store.save({
      key: "second",
      sessionId: "sess-1",
      route: "/api/v1/agent/turn",
      requestHash: "hash-2",
      response: { ok: true },
      status: 200,
      createdAt: "2030-03-26T01:00:00.000Z",
      expiresAt: "2030-03-27T00:00:00.000Z",
    });
    await store.save({
      key: "third",
      sessionId: "sess-1",
      route: "/api/v1/agent/turn",
      requestHash: "hash-3",
      response: { ok: true },
      status: 200,
      createdAt: "2030-03-26T02:00:00.000Z",
      expiresAt: "2030-03-27T00:00:00.000Z",
    });

    expect(await store.load("sess-1", "first")).toBeNull();
    expect(await store.load("sess-1", "second")).toMatchObject({ requestHash: "hash-2" });
    expect(await store.load("sess-1", "third")).toMatchObject({ requestHash: "hash-3" });
  });
});

function createConfig(privateDir: string): AppConfig {
  return {
    appEnv: "development",
    betaAccessMode: "open",
    betaUserEmails: [],
    storageBackend: "file",
    jobBackend: "file",
    llmProvider: "groq",
    toolResultVerbosity: "compact",
    geminiApiKey: undefined,
    groqApiKey: "test-key",
    openAiApiKey: undefined,
    adminApiKey: undefined,
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
    rateLimitMaxKeys: 10000,
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
