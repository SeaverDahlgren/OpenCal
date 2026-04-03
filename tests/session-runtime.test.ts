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
        debugLogPath: workspace.debugLogPath,
        promptContext: {
          kind: "workspace",
          workspace,
        },
        skillManifests: [],
        skillsCatalog: "",
        timezone: "America/Los_Angeles",
      },
      createStoredSession(),
      { type: "message", message: "Schedule lunch with Joe tomorrow at noon." },
    );

    expect(result.response.confirmation?.prompt).toBe(
      'Please confirm: should I create "Lunch with Joe" starting at March 27, 2026 at 12:00 PM PDT?',
    );
    expect(result.session.messages.filter((message) => message.role === "assistant")).toEqual([]);
    expect(result.session.pendingConfirmation).toMatchObject({
      toolName: "create_event",
    });
  });

  it("clears completed task state after a confirmed protected tool succeeds", async () => {
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

    const initial = await runAgentSessionTurn(
      {
        config: createConfig(rootDir),
        provider,
        tools: new Map([[tool.name, tool]]),
        debugLogPath: workspace.debugLogPath,
        promptContext: {
          kind: "workspace",
          workspace,
        },
        skillManifests: [],
        skillsCatalog: "",
        timezone: "America/Los_Angeles",
      },
      createStoredSession(),
      { type: "message", message: "Schedule lunch with Joe tomorrow at noon." },
    );

    expect(initial.session.pendingConfirmation).toMatchObject({ toolName: "create_event" });

    const confirmed = await runAgentSessionTurn(
      {
        config: createConfig(rootDir),
        provider,
        tools: new Map([[tool.name, tool]]),
        debugLogPath: workspace.debugLogPath,
        promptContext: {
          kind: "workspace",
          workspace,
        },
        skillManifests: [],
        skillsCatalog: "",
        timezone: "America/Los_Angeles",
      },
      initial.session,
      { type: "confirm" },
    );

    expect(confirmed.session.pendingConfirmation).toBeNull();
    expect(confirmed.session.taskState).toBeNull();
  });

  it("queues additional protected tool calls and confirms them one by one", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-runtime-"));
    tempDirs.push(rootDir);
    await ensureWorkspace(rootDir);
    const workspace = await loadWorkspaceFiles(rootDir, "2026-03-26");

    const provider: LlmProvider = {
      name: "test",
      async generateDecision() {
        return {
          type: "tool",
          reasoning: "Need two protected actions.",
          toolCalls: [
            {
              name: "update_event",
              arguments: {
                title: "Talk to James",
                start: "2026-03-27T14:00:00-07:00",
              },
            },
            {
              name: "create_event",
              arguments: {
                title: "Job-search session",
                start: "2026-03-27T21:30:00-07:00",
              },
            },
          ],
        };
      },
      async summarizeConversation() {
        return "";
      },
    };

    const updateTool: ToolDefinition<any, unknown> = {
      name: "update_event",
      description: "Update an event.",
      protected: true,
      inputSchema: z.object({
        title: z.string(),
        start: z.string(),
      }),
      promptShape: {
        name: "update_event",
        description: "Update an event.",
        protected: true,
        inputShape: '{"title":"string","start":"string"}',
      },
      async execute() {
        return {
          ok: true,
          data: {},
          summary: "Updated event.",
        };
      },
    };

    const createTool: ToolDefinition<any, unknown> = {
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

    const initial = await runAgentSessionTurn(
      {
        config: createConfig(rootDir),
        provider,
        tools: new Map([
          [updateTool.name, updateTool],
          [createTool.name, createTool],
        ]),
        debugLogPath: workspace.debugLogPath,
        promptContext: {
          kind: "workspace",
          workspace,
        },
        skillManifests: [],
        skillsCatalog: "",
        timezone: "America/Los_Angeles",
      },
      createStoredSession(),
      { type: "message", message: "Move James and add a job-search session." },
    );

    expect(initial.session.pendingConfirmation).toMatchObject({
      toolName: "update_event",
      queuedToolCalls: [
        {
          toolName: "create_event",
        },
      ],
    });

    const firstConfirm = await runAgentSessionTurn(
      {
        config: createConfig(rootDir),
        provider,
        tools: new Map([
          [updateTool.name, updateTool],
          [createTool.name, createTool],
        ]),
        debugLogPath: workspace.debugLogPath,
        promptContext: {
          kind: "workspace",
          workspace,
        },
        skillManifests: [],
        skillsCatalog: "",
        timezone: "America/Los_Angeles",
      },
      initial.session,
      { type: "confirm" },
    );

    expect(firstConfirm.response.assistant.message).toContain("Confirmed. I'll update");
    expect(firstConfirm.response.confirmation?.prompt).toContain('create "Job-search session"');
    expect(firstConfirm.session.pendingConfirmation).toMatchObject({
      toolName: "create_event",
    });
    expect(firstConfirm.session.messages.some((message) => message.name === "update_event")).toBe(true);

    const secondConfirm = await runAgentSessionTurn(
      {
        config: createConfig(rootDir),
        provider,
        tools: new Map([
          [updateTool.name, updateTool],
          [createTool.name, createTool],
        ]),
        debugLogPath: workspace.debugLogPath,
        promptContext: {
          kind: "workspace",
          workspace,
        },
        skillManifests: [],
        skillsCatalog: "",
        timezone: "America/Los_Angeles",
      },
      firstConfirm.session,
      { type: "confirm" },
    );

    expect(secondConfirm.session.pendingConfirmation).toBeNull();
    expect(secondConfirm.session.messages.some((message) => message.name === "create_event")).toBe(true);
  });

  it("hydrates update confirmations with fetched event details when args only include event id and new time", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-runtime-"));
    tempDirs.push(rootDir);
    await ensureWorkspace(rootDir);
    const workspace = await loadWorkspaceFiles(rootDir, "2026-03-26");

    const provider: LlmProvider = {
      name: "test",
      async generateDecision() {
        return {
          type: "tool",
          reasoning: "Update the event.",
          toolCalls: [
            {
              name: "update_event",
              arguments: {
                eventId: "evt-1",
                start: "2026-03-27T14:00:00-07:00",
                end: "2026-03-27T14:30:00-07:00",
              },
            },
          ],
        };
      },
      async summarizeConversation() {
        return "";
      },
    };

    const getEventTool: ToolDefinition<any, unknown> = {
      name: "get_event",
      description: "Fetch an event.",
      protected: false,
      inputSchema: z.object({
        calendarId: z.string(),
        eventId: z.string(),
      }),
      promptShape: {
        name: "get_event",
        description: "Fetch an event.",
        protected: false,
        inputShape: '{"calendarId":"string","eventId":"string"}',
      },
      async execute() {
        return {
          ok: true,
          data: {
            id: "evt-1",
            summary: "Talk to James",
            start: "2026-03-27T09:00:00-07:00",
            end: "2026-03-27T09:30:00-07:00",
          },
          summary: "Fetched event.",
        };
      },
    };

    const updateTool: ToolDefinition<any, unknown> = {
      name: "update_event",
      description: "Update an event.",
      protected: true,
      inputSchema: z.object({
        eventId: z.string(),
        start: z.string().optional(),
        end: z.string().optional(),
        summary: z.string().optional(),
        title: z.string().optional(),
        oldStart: z.string().optional(),
        oldEnd: z.string().optional(),
        calendarId: z.string().optional(),
      }),
      promptShape: {
        name: "update_event",
        description: "Update an event.",
        protected: true,
        inputShape: '{"eventId":"string","start":"string","end":"string"}',
      },
      async execute() {
        return {
          ok: true,
          data: {},
          summary: "Updated event.",
        };
      },
    };

    const result = await runAgentSessionTurn(
      {
        config: createConfig(rootDir),
        provider,
        tools: new Map([
          [getEventTool.name, getEventTool],
          [updateTool.name, updateTool],
        ]),
        debugLogPath: workspace.debugLogPath,
        promptContext: {
          kind: "workspace",
          workspace,
        },
        skillManifests: [],
        skillsCatalog: "",
        timezone: "America/Los_Angeles",
      },
      createStoredSession(),
      { type: "message", message: "Move James to 2 PM." },
    );

    expect(result.response.confirmation?.prompt).toBe(
      'Please confirm: should I move "Talk to James" from March 27, 2026 at 9:00 AM PDT - March 27, 2026 at 9:30 AM PDT to March 27, 2026 at 2:00 PM PDT - March 27, 2026 at 2:30 PM PDT?',
    );
    expect(result.session.pendingConfirmation).toMatchObject({
      arguments: {
        summary: "Talk to James",
        oldStart: "2026-03-27T09:00:00-07:00",
        oldEnd: "2026-03-27T09:30:00-07:00",
      },
    });
  });
});

function createConfig(rootDir: string): AppConfig {
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
