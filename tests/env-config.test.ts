import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("loadConfig", () => {
  it("rejects file-backed core storage in production", () => {
    applyEnv({
      APP_ENV: "production",
      STORAGE_BACKEND: "file",
      JOB_BACKEND: "redis",
      REDIS_URL: "redis://127.0.0.1:6379",
      DATABASE_URL: "postgres://user:pass@db.example.com/opencal",
      STATE_ENCRYPTION_KEY: "secret",
      MIN_SUPPORTED_APP_VERSION: "1.0.0",
      GOOGLE_OAUTH_API_REDIRECT_URI: "https://api.example.com/api/v1/auth/google/callback",
    });

    expect(() => loadConfig(process.cwd())).toThrow(/STORAGE_BACKEND=file is not allowed in production/);
  });

  it("rejects file-backed job queues in production", () => {
    applyEnv({
      APP_ENV: "production",
      STORAGE_BACKEND: "postgres",
      JOB_BACKEND: "file",
      DATABASE_URL: "postgres://user:pass@db.example.com/opencal",
      STATE_ENCRYPTION_KEY: "secret",
      MIN_SUPPORTED_APP_VERSION: "1.0.0",
      GOOGLE_OAUTH_API_REDIRECT_URI: "https://api.example.com/api/v1/auth/google/callback",
    });

    expect(() => loadConfig(process.cwd())).toThrow(/JOB_BACKEND=file is not allowed in production/);
  });

  it("rejects localhost oauth callbacks outside development", () => {
    applyEnv({
      APP_ENV: "staging",
      STORAGE_BACKEND: "postgres",
      JOB_BACKEND: "redis",
      DATABASE_URL: "postgres://user:pass@db.example.com/opencal",
      REDIS_URL: "redis://127.0.0.1:6379",
      STATE_ENCRYPTION_KEY: "secret",
      GOOGLE_OAUTH_API_REDIRECT_URI: "http://127.0.0.1:8787/api/v1/auth/google/callback",
    });

    expect(() => loadConfig(process.cwd())).toThrow(/GOOGLE_OAUTH_API_REDIRECT_URI must be an https URL/);
  });

  it("requires a minimum supported app version in production", () => {
    applyEnv({
      APP_ENV: "production",
      STORAGE_BACKEND: "postgres",
      JOB_BACKEND: "redis",
      DATABASE_URL: "postgres://user:pass@db.example.com/opencal",
      REDIS_URL: "redis://127.0.0.1:6379",
      STATE_ENCRYPTION_KEY: "secret",
      MIN_SUPPORTED_APP_VERSION: "",
      GOOGLE_OAUTH_API_REDIRECT_URI: "https://api.example.com/api/v1/auth/google/callback",
    });

    expect(() => loadConfig(process.cwd())).toThrow(/MIN_SUPPORTED_APP_VERSION is required in production/);
  });

  it("accepts a hosted production config", () => {
    applyEnv({
      APP_ENV: "production",
      STORAGE_BACKEND: "postgres",
      JOB_BACKEND: "redis",
      DATABASE_URL: "postgres://user:pass@db.example.com/opencal",
      REDIS_URL: "redis://127.0.0.1:6379",
      STATE_ENCRYPTION_KEY: "secret",
      MIN_SUPPORTED_APP_VERSION: "1.2.3",
      GOOGLE_OAUTH_API_REDIRECT_URI: "https://api.example.com/api/v1/auth/google/callback",
    });

    const config = loadConfig(process.cwd());
    expect(config.appEnv).toBe("production");
    expect(config.storageBackend).toBe("postgres");
    expect(config.jobBackend).toBe("redis");
  });
});

function applyEnv(overrides: Record<string, string>) {
  process.env = {
    ...originalEnv,
    APP_ENV: "development",
    STORAGE_BACKEND: "file",
    JOB_BACKEND: "file",
    GOOGLE_OAUTH_CLIENT_ID: "google-client-id",
    GOOGLE_OAUTH_CLIENT_SECRET: "google-client-secret",
    GOOGLE_OAUTH_REDIRECT_URI: "http://127.0.0.1:42813/oauth/callback",
    GOOGLE_OAUTH_API_REDIRECT_URI: "http://127.0.0.1:8787/api/v1/auth/google/callback",
    ...overrides,
  };
}
