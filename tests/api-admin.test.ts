import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SessionStore } from "../apps/api/src/sessions/store.js";
import type { AppConfig } from "../src/config/env.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("admin-ready session store helpers", () => {
  it("lists sessions and loads them by session id", async () => {
    const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-admin-session-store-"));
    createdDirs.push(privateDir);
    const store = new SessionStore(createConfig(privateDir));
    const first = await store.createOrReplaceSession({
      name: "Avery",
      email: "avery@example.com",
    });
    const second = await store.createOrReplaceSession({
      name: "Jordan",
      email: "jordan@example.com",
    });

    const sessions = await store.listSessions();

    expect(sessions).toHaveLength(2);
    expect(await store.loadBySessionId(first.sessionId)).toMatchObject({ user: { email: "avery@example.com" } });
    expect(await store.loadBySessionId(second.sessionId)).toMatchObject({ user: { email: "jordan@example.com" } });
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
    adminApiKey: "admin-secret",
    googleClientId: "google-client-id",
    googleClientSecret: "google-client-secret",
    googleRedirectUri: "http://127.0.0.1:42813/oauth/callback",
    googleApiRedirectUri: "http://127.0.0.1:8787/api/v1/auth/google/callback",
    contextWindowLimit: 128000,
    maxOutputTokens: 2000,
    compactionThreshold: 0.8,
    sessionTtlDays: 14,
    rateLimitWindowMs: 60000,
    rateLimitMaxRequests: 120,
    openAiModel: "gpt-5-mini",
    geminiModel: "gemini-2.5-flash",
    groqModel: "llama-3.3-70b-versatile",
    rootDir: privateDir,
    privateDir,
  };
}
