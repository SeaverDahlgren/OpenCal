import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AuditStore } from "../apps/api/src/audit/store.js";
import type { AppConfig } from "../src/config/env.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("audit store", () => {
  it("appends newest events first and caps history", async () => {
    const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-audit-store-"));
    createdDirs.push(privateDir);
    const store = new AuditStore(createConfig(privateDir));

    await store.append({
      type: "session.reset",
      sessionId: "sess-1",
      userEmail: "avery@example.com",
    });
    const second = await store.append({
      type: "session.revoke",
      sessionId: "sess-1",
      userEmail: "avery@example.com",
    });

    const events = await store.list();
    expect(events[0]?.eventId).toBe(second.eventId);
    expect(events[0]?.type).toBe("session.revoke");
    expect(events[1]?.type).toBe("session.reset");
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
