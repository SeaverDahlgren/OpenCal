import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JobStore, buildNextRunAt } from "../apps/api/src/jobs/store.js";
import type { JobRecord } from "../apps/api/src/jobs/types.js";
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

    const pending = await store.fail(job.jobId, "temporary", buildNextRunAt(1000, "2000-03-26T00:00:00.000Z"));
    expect(pending).toMatchObject({
      status: "pending",
      lastError: "temporary",
    });

    const again = await store.reserveNext();
    expect(again?.jobId).toBe(job.jobId);

    const exhausted = await store.fail(job.jobId, "still broken");
    expect(exhausted).toMatchObject({
      status: "exhausted",
      lastError: "still broken",
      attempts: 2,
    });
  });

  it("requeues an existing job for immediate retry", async () => {
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
      runAt: "2030-03-26T00:00:00.000Z",
    });

    const retried = await store.retry(job.jobId, "2000-03-26T00:00:00.000Z");

    expect(retried).toMatchObject({
      jobId: job.jobId,
      status: "pending",
      runAt: "2000-03-26T00:00:00.000Z",
    });
  });

  it("prunes terminal jobs older than the retention window", async () => {
    const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-job-store-"));
    createdDirs.push(privateDir);
    const store = new JobStore({ ...createConfig(privateDir), jobRetentionDays: 1 });

    const job = await store.enqueue({
      kind: "agent_turn_retry",
      payload: {
        sessionId: "sess-1",
        action: { type: "message", message: "retry this" },
      },
      maxAttempts: 2,
      runAt: "2000-03-26T00:00:00.000Z",
    });

    await store.reserveNext();
    const completed = await store.complete(job.jobId, {
      assistant: { message: "done" },
      taskState: {
        taskId: "task-1",
        summary: "Retry this",
        status: "idle",
        hasBlockedPrompt: false,
      },
      clarification: null,
      confirmation: null,
      artifacts: [],
      session: { hasBlockedTask: false },
    });

    const staleStatePath = path.join(privateDir, "jobs.json");
    const raw = await fs.readFile(staleStatePath, "utf8");
    const parsed = JSON.parse(raw) as { jobs: Record<string, JobRecord> };
    parsed.jobs[job.jobId] = {
      ...parsed.jobs[job.jobId],
      status: "completed",
      updatedAt: "2000-03-26T00:00:00.000Z",
    };
    await fs.writeFile(staleStatePath, JSON.stringify(parsed, null, 2), "utf8");

    expect(await store.list()).toEqual([]);
    expect(await store.load(job.jobId)).toBeNull();
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
