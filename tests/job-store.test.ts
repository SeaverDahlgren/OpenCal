import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JobStore, buildNextRunAt } from "../apps/api/src/jobs/store.js";
import type { AppConfig } from "../src/config/env.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("job store", () => {
  it("enqueues and reserves runnable jobs", async () => {
    const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-job-store-"));
    createdDirs.push(privateDir);
    const store = new JobStore(createConfig(privateDir));

    const job = await store.enqueue({
      kind: "agent_turn_retry",
      payload: {
        sessionId: "sess-1",
        action: { type: "message", message: "retry this" },
      },
      maxAttempts: 3,
      runAt: "2030-03-26T00:00:00.000Z",
    });

    expect(await store.load(job.jobId)).toMatchObject({
      status: "pending",
      attempts: 0,
    });
  });

  it("fails back to pending until max attempts are exhausted", async () => {
    const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-job-store-"));
    createdDirs.push(privateDir);
    const store = new JobStore(createConfig(privateDir));
    const job = await store.enqueue({
      kind: "agent_turn_retry",
      payload: {
        sessionId: "sess-1",
        action: { type: "message", message: "retry this" },
      },
      maxAttempts: 2,
      runAt: "2000-03-26T00:00:00.000Z",
    });

    const reserved = await store.reserveNext();
    expect(reserved?.jobId).toBe(job.jobId);

    const pending = await store.fail(job.jobId, "temporary", buildNextRunAt(1000, "2030-03-26T00:00:00.000Z"));
    expect(pending).toMatchObject({
      status: "pending",
      lastError: "temporary",
    });
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
    adminApiKey: undefined,
    stateEncryptionKey: undefined,
    apiVersion: "1.0.0",
    minSupportedAppVersion: undefined,
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
