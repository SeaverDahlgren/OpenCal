import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { UserProfileStore } from "../apps/api/src/users/store.js";
import { renderLegacyUserMarkdown, updateUserProfile } from "../apps/api/src/users/profile.js";
import type { AppConfig } from "../src/config/env.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdDirs.splice(0).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    }),
  );
});

describe("user profile store", () => {
  it("seeds a new user profile with production defaults instead of legacy markdown", async () => {
    const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-profile-store-"));
    createdDirs.push(privateDir);
    const store = new UserProfileStore(createConfig(privateDir));

    const profile = await store.loadOrCreate({
      name: "Avery",
      email: "avery@example.com",
    });

    expect(profile).toMatchObject({
      email: "avery@example.com",
      name: "Avery",
      workStart: "09:00",
      workEnd: "17:00",
      meetingPreference: "",
      interests: "",
      additionalContext: "",
      assistantNotes: "",
      personalizationCompletedAt: undefined,
    });
  });

  it("persists profile updates independently of USER.md", async () => {
    const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-profile-store-"));
    createdDirs.push(privateDir);
    const store = new UserProfileStore(createConfig(privateDir));

    const current = await store.loadOrCreate({
      name: "Avery",
      email: "avery@example.com",
    });

    const updated = updateUserProfile(current, {
      name: "Avery Mercer",
      timezone: "America/New_York",
      interests: "Running",
    }, "2026-03-25T00:05:00.000Z");
    await store.save(updated);

    const loaded = await store.load("avery@example.com");

    expect(loaded).toMatchObject({
      name: "Avery Mercer",
      timezone: "America/New_York",
      interests: "Running",
    });
    expect(renderLegacyUserMarkdown(loaded!)).toContain("timezone: America/New_York");
    expect(renderLegacyUserMarkdown(loaded!)).toContain("interests: Running");
  });

  it("does not clear onboarding completion when later updates omit that field", async () => {
    const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-profile-store-"));
    createdDirs.push(privateDir);
    const store = new UserProfileStore(createConfig(privateDir));

    const current = await store.loadOrCreate({
      name: "Avery",
      email: "avery@example.com",
    });

    const completed = updateUserProfile(current, {
      personalizationCompletedAt: "2026-03-25T00:05:00.000Z",
      interests: "Running",
    }, "2026-03-25T00:05:00.000Z");
    const later = updateUserProfile(completed, {
      name: "Avery Mercer",
      personalizationCompletedAt: undefined,
    }, "2026-03-25T00:10:00.000Z");
    await store.save(later);

    const loaded = await store.load("avery@example.com");

    expect(loaded).toMatchObject({
      name: "Avery Mercer",
      interests: "Running",
      personalizationCompletedAt: "2026-03-25T00:05:00.000Z",
    });
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
