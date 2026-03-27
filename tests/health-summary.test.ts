import { describe, expect, it } from "vitest";
import { buildReadyPayload } from "../apps/api/src/server/health.js";
import type { AppConfig } from "../src/config/env.js";

describe("ready payload", () => {
  it("summarizes active backends and job counts", () => {
    const payload = buildReadyPayload(createConfig(), [
      createJob("pending"),
      createJob("running"),
      createJob("completed"),
      createJob("exhausted"),
    ]);

    expect(payload).toMatchObject({
      status: "degraded",
      storageBackend: "file",
      jobBackend: "file",
      jobs: {
        total: 4,
        pending: 1,
        running: 1,
        completed: 1,
        exhausted: 1,
      },
    });
  });
});

function createJob(status: "pending" | "running" | "completed" | "failed" | "exhausted") {
  return {
    jobId: `job-${status}`,
    kind: "agent_turn_retry" as const,
    status,
    attempts: 1,
    maxAttempts: 3,
    runAt: "2026-03-26T20:00:00.000Z",
    createdAt: "2026-03-26T20:00:00.000Z",
    updatedAt: "2026-03-26T20:00:00.000Z",
    payload: {
      sessionId: "sess-123",
      action: { type: "message" as const, message: "retry" },
    },
  };
}

function createConfig(): AppConfig {
  return {
    appEnv: "staging",
    storageBackend: "file",
    jobBackend: "file",
    llmProvider: "groq",
    toolResultVerbosity: "compact",
    geminiApiKey: undefined,
    groqApiKey: "test-key",
    openAiApiKey: undefined,
    adminApiKey: undefined,
    stateEncryptionKey: "secret",
    apiVersion: "1.0.0",
    minSupportedAppVersion: "1.2.0",
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
    openAiModel: "gpt-5-mini",
    geminiModel: "gemini-2.5-flash",
    groqModel: "llama-3.3-70b-versatile",
    rootDir: process.cwd(),
    privateDir: `${process.cwd()}/.opencal`,
  };
}
