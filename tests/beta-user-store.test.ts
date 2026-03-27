import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BetaUserStore } from "../apps/api/src/beta-users/store.js";
import type { AppConfig } from "../src/config/env.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("beta user store", () => {
  it("seeds env allowlist users and persists admin-added users", async () => {
    const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-beta-user-store-"));
    createdDirs.push(privateDir);
    const store = new BetaUserStore(
      createConfig(privateDir, { betaUserEmails: ["avery@example.com", "jordan@example.com"] }),
    );

    expect(await store.isAllowed("avery@example.com")).toBe(true);
    expect(await store.isAllowed("jordan@example.com")).toBe(true);

    const added = await store.add({
      email: "sam@example.com",
      name: "Sam",
      addedBy: "admin",
    });

    expect(added).toMatchObject({
      email: "sam@example.com",
      name: "Sam",
      source: "admin",
    });
    expect(await store.isAllowed("sam@example.com")).toBe(true);
  });

  it("removes beta users by normalized email", async () => {
    const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-beta-user-store-"));
    createdDirs.push(privateDir);
    const store = new BetaUserStore(createConfig(privateDir));

    await store.add({
      email: "Sam@Example.com",
      name: "Sam",
      addedBy: "admin",
    });

    const removed = await store.remove("sam@example.com");
    expect(removed).toMatchObject({
      email: "sam@example.com",
    });
    expect(await store.isAllowed("sam@example.com")).toBe(false);
  });
});

function createConfig(privateDir: string, overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    appEnv: "development",
    betaAccessMode: "allowlist",
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
    ...overrides,
  };
}
