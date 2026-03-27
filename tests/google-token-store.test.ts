import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GoogleTokenStore } from "../apps/api/src/auth/token-store.js";
import type { AppConfig } from "../src/config/env.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdDirs.splice(0).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    }),
  );
});

describe("google token store", () => {
  it("persists tokens per user email", async () => {
    const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-google-token-store-"));
    createdDirs.push(privateDir);
    const store = new GoogleTokenStore(createConfig(privateDir, "secret-key"));

    await store.save("avery@example.com", {
      refresh_token: "refresh-1",
      access_token: "access-1",
    });
    await store.save("jordan@example.com", {
      refresh_token: "refresh-2",
      access_token: "access-2",
    });

    expect(await store.load("avery@example.com")).toMatchObject({
      refresh_token: "refresh-1",
    });
    expect(await store.load("jordan@example.com")).toMatchObject({
      refresh_token: "refresh-2",
    });
    const raw = await fs.readFile(path.join(privateDir, "google-user-tokens.json"), "utf8");
    expect(raw).not.toContain("refresh-1");
  });
});

function createConfig(privateDir: string, stateEncryptionKey?: string): AppConfig {
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
    stateEncryptionKey,
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
