import { describe, expect, it } from "vitest";
import { createLlmProvider } from "../src/llm/factory.js";
import type { AppConfig } from "../src/config/env.js";

const baseConfig: AppConfig = {
  appEnv: "development",
  storageBackend: "file",
  jobBackend: "file",
  llmProvider: "gemini",
  toolResultVerbosity: "compact",
  geminiApiKey: "gemini-key",
  groqApiKey: "groq-key",
  openAiApiKey: undefined,
  adminApiKey: undefined,
  stateEncryptionKey: undefined,
  apiVersion: "1.0.0",
  minSupportedAppVersion: undefined,
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
  openAiModel: "gpt-5-mini",
  geminiModel: "gemini-2.5-flash",
  groqModel: "llama-3.3-70b-versatile",
  rootDir: process.cwd(),
  privateDir: `${process.cwd()}/.opencal`,
};

describe("createLlmProvider", () => {
  it("builds the Groq adapter", () => {
    const provider = createLlmProvider({
      ...baseConfig,
      llmProvider: "groq",
    });

    expect(provider.name).toBe("groq");
  });

  it("builds the Gemini adapter", () => {
    const provider = createLlmProvider(baseConfig);

    expect(provider.name).toBe("gemini");
  });
});
