import { describe, expect, it } from "vitest";
import { buildPreflightReport } from "../apps/api/src/deploy/preflight.js";
import type { AppConfig } from "../src/config/env.js";

describe("deploy preflight", () => {
  it("flags production file-backed infrastructure as an error", () => {
    const report = buildPreflightReport(createConfig({ appEnv: "production" }));

    expect(report.ok).toBe(false);
    expect(report.errors).toEqual(
      expect.arrayContaining([
        "Production should use STORAGE_BACKEND=postgres.",
        "Production should use JOB_BACKEND=redis.",
      ]),
    );
  });

  it("warns when hosted return targets and support keys are missing", () => {
    const report = buildPreflightReport(
      createConfig({
        appEnv: "staging",
        storageBackend: "postgres",
        jobBackend: "redis",
        allowedReturnToPrefixes: [],
        adminApiKey: undefined,
      }),
    );

    expect(report.ok).toBe(true);
    expect(report.warnings).toEqual(
      expect.arrayContaining([
        "ADMIN_API_KEY is unset. Support endpoints remain disabled.",
        "ALLOWED_RETURN_TO_PREFIXES is empty. Hosted deep-link return targets are not configured.",
      ]),
    );
  });

  it("passes a hosted production config without warnings", () => {
    const report = buildPreflightReport(
      createConfig({
        appEnv: "production",
        storageBackend: "postgres",
        jobBackend: "redis",
        adminApiKey: "admin-key",
        minSupportedAppVersion: "1.2.3",
        allowedReturnToPrefixes: ["https://app.example.com/auth"],
        googleApiRedirectUri: "https://api.example.com/api/v1/auth/google/callback",
      }),
    );

    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
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
    adminApiKey: "admin-key",
    stateEncryptionKey: "secret",
    apiVersion: "1.0.0",
    minSupportedAppVersion: undefined,
    allowedReturnToPrefixes: ["opencal://auth-callback"],
    databaseUrl: undefined,
    redisUrl: undefined,
    googleClientId: "google-client-id",
    googleClientSecret: "google-client-secret",
    googleRedirectUri: "http://127.0.0.1:42813/oauth/callback",
    googleApiRedirectUri: "https://api.example.com/api/v1/auth/google/callback",
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
