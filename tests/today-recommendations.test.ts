import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TodayRecommendationStore } from "../apps/api/src/recommendations/store.js";
import { TodayRecommendationService } from "../apps/api/src/recommendations/service.js";
import type { AppConfig } from "../src/config/env.js";
import type { UserProfile } from "../apps/api/src/users/profile.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("today recommendations", () => {
  it("generates and stores a recommendation on cache miss", async () => {
    const privateDir = await makePrivateDir();
    const store = new TodayRecommendationStore(createConfig(privateDir));
    const generate = vi.fn(async () => ({
      title: "Protect your morning",
      body: "Handle your most important work before your afternoon meeting.",
      actionLabel: "Plan this with AI",
      action: {
        type: "chat_prompt" as const,
        prompt: "Help me execute today’s plan.",
      },
    }));
    const service = new TodayRecommendationService(store, generate);

    const result = await service.getOrCreate(createInput());
    const saved = await store.load("avery@example.com", "2026-03-31");

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result?.title).toBe("Protect your morning");
    expect(saved).toEqual(
      expect.objectContaining({
        email: "avery@example.com",
        date: "2026-03-31",
        timezone: "America/Los_Angeles",
        title: "Protect your morning",
      }),
    );
  });

  it("reuses the cached recommendation later the same day", async () => {
    const privateDir = await makePrivateDir();
    const store = new TodayRecommendationStore(createConfig(privateDir));
    const generate = vi.fn(async () => ({
      title: "Front-load focus",
      body: "Use your open morning block before your sync.",
      actionLabel: "Plan this with AI",
      action: {
        type: "chat_prompt" as const,
        prompt: "Help me execute today’s plan.",
      },
    }));
    const service = new TodayRecommendationService(store, generate);

    const first = await service.getOrCreate(createInput());
    const second = await service.getOrCreate(createInput());

    expect(generate).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it("generates a new recommendation on the next local day", async () => {
    const privateDir = await makePrivateDir();
    const store = new TodayRecommendationStore(createConfig(privateDir));
    const generate = vi
      .fn()
      .mockResolvedValueOnce({
        title: "Tuesday plan",
        body: "Ship the highest-value work before lunch.",
        actionLabel: "Plan this with AI",
        action: {
          type: "chat_prompt" as const,
          prompt: "Help me execute today’s plan.",
        },
      })
      .mockResolvedValueOnce({
        title: "Wednesday plan",
        body: "Use the quieter afternoon for follow-through.",
        actionLabel: "Plan this with AI",
        action: {
          type: "chat_prompt" as const,
          prompt: "Help me execute today’s plan.",
        },
      });
    const service = new TodayRecommendationService(store, generate);

    const first = await service.getOrCreate(createInput({ date: "2026-03-31" }));
    const second = await service.getOrCreate(createInput({ date: "2026-04-01" }));

    expect(generate).toHaveBeenCalledTimes(2);
    expect(first?.title).toBe("Tuesday plan");
    expect(second?.title).toBe("Wednesday plan");
  });

  it("falls back to null when generation fails", async () => {
    const privateDir = await makePrivateDir();
    const store = new TodayRecommendationStore(createConfig(privateDir));
    const onError = vi.fn();
    const service = new TodayRecommendationService(
      store,
      vi.fn(async () => {
        throw new Error("provider unavailable");
      }),
      onError,
    );

    const result = await service.getOrCreate(createInput());
    const saved = await store.load("avery@example.com", "2026-03-31");

    expect(result).toBeNull();
    expect(saved).toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

async function makePrivateDir() {
  const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-today-recommendations-"));
  createdDirs.push(privateDir);
  return privateDir;
}

function createInput(overrides: Partial<Parameters<TodayRecommendationService["getOrCreate"]>[0]> = {}) {
  const profile: UserProfile = {
    email: "avery@example.com",
    name: "Avery",
    timezone: "America/Los_Angeles",
    workStart: "09:00",
    workEnd: "17:00",
    meetingPreference: "Avoid back-to-back meetings.",
    interests: "Running and AI agents",
    additionalContext: "Keep advice tactical.",
    assistantNotes: "Protect the first hour for deep work.",
    updatedAt: "2026-03-30T20:00:00.000Z",
  };

  return {
    user: {
      name: "Avery",
      email: "avery@example.com",
    },
    profile,
    date: "2026-03-31",
    timezone: profile.timezone,
    schedule: [
      {
        eventId: "evt-1",
        title: "Job discussion with Sally",
        timeLabel: "5:00 PM - 5:30 PM",
        attendeePreview: ["sally@example.com"],
      },
    ],
    ...overrides,
  };
}

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
    allowedWebOrigins: [],
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
