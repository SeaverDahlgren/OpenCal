import { afterEach, describe, expect, it, vi } from "vitest";
import { google } from "googleapis";
import { ApiAuthService } from "../apps/api/src/auth/service.js";
import type { AppConfig } from "../src/config/env.js";
import * as googleAuth from "../src/integrations/google/auth.js";

const baseConfig: AppConfig = {
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
    const service = new ApiAuthService(baseConfig, {} as never, {} as never);
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
      credentials: {
        refresh_token: "refresh-token",
        access_token: "access-token",
      },
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
    const tokenStore = {
      save: vi.fn(async () => undefined),
    };
    const service = new ApiAuthService(baseConfig, {
      getByUserEmail: async () => currentSession,
    } as never, tokenStore as never);

    await expect(service.reuseAuthorizedSession()).resolves.toEqual(currentSession);
    expect(tokenStore.save).toHaveBeenCalledWith("avery@example.com", expect.anything());
  });

  it("disables local auth reuse outside development", async () => {
    const service = new ApiAuthService(
      {
        ...baseConfig,
        appEnv: "production",
      },
      {} as never,
      {} as never,
    );

    await expect(service.reuseAuthorizedSession()).resolves.toBeNull();
  });
});
