import { describe, expect, it } from "vitest";
import { ApiAuthService } from "../apps/api/src/auth/service.js";
import type { AppConfig } from "../src/config/env.js";

const baseConfig: AppConfig = {
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
  rootDir: process.cwd(),
  privateDir: `${process.cwd()}/.opencal`,
};

describe("api auth service", () => {
  it("builds Google auth URLs against the API callback by default", () => {
    const service = new ApiAuthService(baseConfig, {} as never);
    const url = new URL(service.buildAuthUrl("state-123"));

    expect(url.searchParams.get("redirect_uri")).toBe(baseConfig.googleApiRedirectUri);
    expect(url.searchParams.get("state")).toBe("state-123");
  });
});
