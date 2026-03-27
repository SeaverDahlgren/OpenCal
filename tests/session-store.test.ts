import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SessionStore } from "../apps/api/src/sessions/store.js";
import type { AppConfig } from "../src/config/env.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdDirs.splice(0).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    }),
  );
});

describe("session store", () => {
  it("creates, loads, saves, and resets user sessions without global current-session coupling", async () => {
    const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-session-store-"));
    createdDirs.push(privateDir);
    const store = new SessionStore(createConfig(privateDir));

    const session = await store.createOrReplaceSession({
      name: "Avery",
      email: "avery@example.com",
    });
    const other = await store.createOrReplaceSession({
      name: "Jordan",
      email: "jordan@example.com",
    });

    expect(session.provider).toBe("groq");
    expect(session.model).toBe("llama-3.3-70b-versatile");
    expect(other.sessionId).not.toBe(session.sessionId);

    const byToken = await store.loadByToken(session.token);
    expect(byToken?.sessionId).toBe(session.sessionId);
    expect(await store.getByUserEmail("jordan@example.com")).toMatchObject({ sessionId: other.sessionId });
    const raw = await fs.readFile(path.join(privateDir, "mobile-sessions.json"), "utf8");
    expect(raw).not.toContain(session.token);
    expect(raw).toContain("tokenHash");

    const updated = {
      ...session,
      messages: [
        {
          role: "user" as const,
          content: "Reschedule my meeting with Joe",
          timestamp: new Date().toISOString(),
        },
      ],
    };
    await store.save(updated);

    const current = await store.getByUserEmail("avery@example.com");
    expect(current?.messages).toHaveLength(1);

    const reset = await store.resetSession(session.sessionId);
    expect(reset?.messages).toEqual([]);
    expect(reset?.provider).toBe("groq");
    expect(reset?.model).toBe("llama-3.3-70b-versatile");
    expect((await store.getByUserEmail("jordan@example.com"))?.sessionId).toBe(other.sessionId);
  });

  it("prunes expired sessions on read", async () => {
    const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-session-store-"));
    createdDirs.push(privateDir);
    const store = new SessionStore(createConfig(privateDir));
    const session = await store.createOrReplaceSession({
      name: "Avery",
      email: "avery@example.com",
    });

    await store.save({
      ...session,
      expiresAt: "2000-01-01T00:00:00.000Z",
    });

    expect(await store.loadByToken(session.token)).toBeNull();
    expect(await store.getByUserEmail("avery@example.com")).toBeNull();
  });

  it("deletes a session on revoke", async () => {
    const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-session-store-"));
    createdDirs.push(privateDir);
    const store = new SessionStore(createConfig(privateDir));
    const session = await store.createOrReplaceSession({
      name: "Avery",
      email: "avery@example.com",
    });

    const deleted = await store.deleteSession(session.sessionId);

    expect(deleted?.sessionId).toBe(session.sessionId);
    expect(await store.loadByToken(session.token)).toBeNull();
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
    maxRequestBodyBytes: 1024 * 1024,
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
