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
    adminApiKey: undefined,
    stateEncryptionKey: undefined,
    apiVersion: "1.0.0",
    minSupportedAppVersion: undefined,
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
    openAiModel: "gpt-5-mini",
    geminiModel: "gemini-2.5-flash",
    groqModel: "llama-3.3-70b-versatile",
    rootDir: privateDir,
    privateDir,
  };
}
