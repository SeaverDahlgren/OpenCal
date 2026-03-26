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
  it("creates, loads, saves, and resets the current mobile session", async () => {
    const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-session-store-"));
    createdDirs.push(privateDir);
    const store = new SessionStore(createConfig(privateDir));

    const session = await store.createOrReplaceSession({
      name: "Seaver",
      email: "seaver@example.com",
    });

    expect(session.provider).toBe("groq");
    expect(session.model).toBe("llama-3.3-70b-versatile");

    const byToken = await store.loadByToken(session.token);
    expect(byToken?.sessionId).toBe(session.sessionId);

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

    const current = await store.getCurrentSession();
    expect(current?.messages).toHaveLength(1);

    const reset = await store.resetCurrentSession();
    expect(reset?.messages).toEqual([]);
    expect(reset?.provider).toBe("groq");
    expect(reset?.model).toBe("llama-3.3-70b-versatile");
  });
});

function createConfig(privateDir: string): AppConfig {
  return {
    llmProvider: "groq",
    toolResultVerbosity: "compact",
    geminiApiKey: undefined,
    groqApiKey: "test-key",
    openAiApiKey: undefined,
    googleClientId: "google-client-id",
    googleClientSecret: "google-client-secret",
    googleRedirectUri: "http://127.0.0.1:42813/oauth/callback",
    googleApiRedirectUri: "http://127.0.0.1:8787/api/v1/auth/google/callback",
    contextWindowLimit: 128000,
    maxOutputTokens: 2000,
    compactionThreshold: 0.8,
    openAiModel: "gpt-5-mini",
    geminiModel: "gemini-2.5-flash",
    groqModel: "llama-3.3-70b-versatile",
    rootDir: privateDir,
    privateDir,
  };
}
