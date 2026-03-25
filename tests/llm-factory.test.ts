import { describe, expect, it } from "vitest";
import { createLlmProvider } from "../src/llm/factory.js";
import type { AppConfig } from "../src/config/env.js";

const baseConfig: AppConfig = {
  llmProvider: "gemini",
  toolResultVerbosity: "compact",
  geminiApiKey: "gemini-key",
  groqApiKey: "groq-key",
  openAiApiKey: undefined,
  googleClientId: "client-id",
  googleClientSecret: "client-secret",
  googleRedirectUri: "http://127.0.0.1:42813/oauth/callback",
  contextWindowLimit: 128000,
  maxOutputTokens: 2000,
  compactionThreshold: 0.8,
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
