import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readSecureJsonFile, writeSecureJsonFile } from "../apps/api/src/storage/secure-json.js";
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

describe("secure json storage", () => {
  it("round-trips encrypted state files", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-secure-json-"));
    createdDirs.push(rootDir);
    const filePath = path.join(rootDir, "state.json");

    await writeSecureJsonFile(filePath, { hello: "world" }, "secret-key");

    const raw = await fs.readFile(filePath, "utf8");
    expect(raw).not.toContain("world");
    await expect(readSecureJsonFile<{ hello: string }>(filePath, "secret-key")).resolves.toEqual({
      hello: "world",
    });
  });

  it("encrypts persisted session state when a key is configured", async () => {
    const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-secure-session-store-"));
    createdDirs.push(privateDir);
    const store = new SessionStore(createConfig(privateDir, "secret-key"));

    const session = await store.createOrReplaceSession({
      name: "Avery",
      email: "avery@example.com",
    });

    const raw = await fs.readFile(path.join(privateDir, "mobile-sessions.json"), "utf8");
    expect(raw).not.toContain(session.token);
    expect(await store.loadByToken(session.token)).toMatchObject({ sessionId: session.sessionId });
  });
});

function createConfig(privateDir: string, stateEncryptionKey?: string): AppConfig {
  return {
    appEnv: "development",
    llmProvider: "groq",
    toolResultVerbosity: "compact",
    geminiApiKey: undefined,
    groqApiKey: "test-key",
    openAiApiKey: undefined,
    adminApiKey: undefined,
    stateEncryptionKey,
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
