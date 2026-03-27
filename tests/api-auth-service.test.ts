import { afterEach, describe, expect, it, vi } from "vitest";
import { google } from "googleapis";
import { ApiAuthService } from "../apps/api/src/auth/service.js";
import type { AppConfig } from "../src/config/env.js";
import * as googleAuth from "../src/integrations/google/auth.js";

const baseConfig: AppConfig = {
  appEnv: "development",
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
  sessionTtlDays: 14,
  rateLimitWindowMs: 60000,
  rateLimitMaxRequests: 120,
  openAiModel: "gpt-5-mini",
  geminiModel: "gemini-2.5-flash",
  groqModel: "llama-3.3-70b-versatile",
  rootDir: process.cwd(),
  privateDir: `${process.cwd()}/.opencal`,
};

describe("api auth service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds Google auth URLs against the API callback by default", () => {
    const service = new ApiAuthService(baseConfig, {} as never);
    const url = new URL(service.buildAuthUrl("state-123"));

    expect(url.searchParams.get("redirect_uri")).toBe(baseConfig.googleApiRedirectUri);
    expect(url.searchParams.get("state")).toBe("state-123");
  });

  it("reuses the current session when local Google auth already exists", async () => {
    const currentSession = {
      sessionId: "sess_123",
      token: "token_123",
      user: {
        name: "Avery",
        email: "avery@example.com",
      },
    };
    vi.spyOn(googleAuth, "loadStoredGoogleAuthorization").mockResolvedValue({
      getAccessToken: async () => ({ token: "access-token" }),
    } as never);
    vi.spyOn(google, "oauth2").mockReturnValue({
      userinfo: {
        get: async () => ({
          data: {
            name: "Avery",
            email: "avery@example.com",
          },
        }),
      },
    } as never);
    const service = new ApiAuthService(baseConfig, {
      getByUserEmail: async () => currentSession,
    } as never);

    await expect(service.reuseAuthorizedSession()).resolves.toEqual(currentSession);
  });
});
