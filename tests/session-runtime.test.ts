import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { runAgentSessionTurn } from "../src/app/session-runtime.js";
import type { StoredSessionState } from "../src/app/session-types.js";
import type { AppConfig } from "../src/config/env.js";
import type { LlmProvider } from "../src/llm/provider.js";
import { ensureWorkspace, loadWorkspaceFiles } from "../src/memory/workspace.js";
import type { ToolDefinition } from "../src/tools/types.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("session runtime", () => {
  it("keeps confirmation prompts out of persisted chat history", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-runtime-"));
    tempDirs.push(rootDir);
    await ensureWorkspace(rootDir);
    const workspace = await loadWorkspaceFiles(rootDir, "2026-03-26");

    const provider: LlmProvider = {
      name: "test",
      async generateDecision() {
        return {
          type: "tool",
          reasoning: "Need protected tool confirmation.",
          toolCalls: [
            {
              name: "create_event",
              arguments: {
                title: "Lunch with Joe",
                start: "2026-03-27T12:00:00-07:00",
              },
            },
          ],
        };
      },
      async summarizeConversation() {
        return "";
      },
    };

    const tool: ToolDefinition<any, unknown> = {
      name: "create_event",
      description: "Create an event.",
      protected: true,
      inputSchema: z.object({
        title: z.string(),
        start: z.string(),
      }),
      promptShape: {
        name: "create_event",
        description: "Create an event.",
        protected: true,
        inputShape: '{"title":"string","start":"string"}',
      },
      async execute() {
        return {
          ok: true,
          data: {},
          summary: "Created event.",
        };
      },
    };

    const result = await runAgentSessionTurn(
      {
        config: createConfig(rootDir),
        provider,
        tools: new Map([[tool.name, tool]]),
        workspace,
        skillManifests: [],
        skillsCatalog: "",
        timezone: "America/Los_Angeles",
      },
      createStoredSession(),
      { type: "message", message: "Schedule lunch with Joe tomorrow at noon." },
    );

    expect(result.response.confirmation?.prompt).toBe(
      'Please confirm: should I create "Lunch with Joe" starting at 2026-03-27T12:00:00-07:00?',
    );
    expect(result.session.messages.filter((message) => message.role === "assistant")).toEqual([]);
    expect(result.session.pendingConfirmation).toMatchObject({
      toolName: "create_event",
    });
  });
});

function createConfig(rootDir: string): AppConfig {
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
    googleClientId: "client-id",
    googleClientSecret: "client-secret",
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
    rootDir,
    privateDir: path.join(rootDir, ".opencal"),
  };
}

function createStoredSession(): StoredSessionState {
  return {
    sessionId: "sess-123",
    token: "token-123",
    expiresAt: "2026-04-25T00:00:00.000Z",
    user: { name: "Avery", email: "avery@example.com" },
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    toolResultVerbosity: "compact",
    createdAt: "2026-03-25T00:00:00.000Z",
    updatedAt: "2026-03-25T00:00:00.000Z",
    messages: [],
    taskState: null,
    pendingConfirmation: null,
  };
}
