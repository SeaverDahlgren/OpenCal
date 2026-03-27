import { describe, expect, it } from "vitest";
import type { AppConfig } from "../src/config/env.js";
import { createRuntimeStores } from "../apps/api/src/bootstrap/runtime.js";

describe("runtime bootstrap", () => {
  it("creates file-backed stores by default", () => {
    const stores = createRuntimeStores(createConfig());

    expect(stores.sessions).toBeTruthy();
    expect(stores.profiles).toBeTruthy();
    expect(stores.tokens).toBeTruthy();
    expect(stores.idempotency).toBeTruthy();
    expect(stores.jobs).toBeTruthy();
  });

  it("rejects unsupported storage backends", () => {
    expect(() => createRuntimeStores(createConfig({ storageBackend: "postgres" }))).toThrow(
      "Unsupported STORAGE_BACKEND: postgres",
    );
    expect(() => createRuntimeStores(createConfig({ jobBackend: "redis" }))).toThrow(
      "Unsupported JOB_BACKEND: redis",
    );
  });
});

function createConfig(overrides: Partial<AppConfig> = {}): AppConfig {
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
    rootDir: process.cwd(),
    privateDir: `${process.cwd()}/.opencal`,
    ...overrides,
  };
}
