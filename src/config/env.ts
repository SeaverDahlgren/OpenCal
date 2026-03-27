import path from "node:path";
import { config as loadDotEnv } from "dotenv";
import { z } from "zod";

loadDotEnv();

const envSchema = z.object({
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  STORAGE_BACKEND: z.enum(["file", "postgres"]).default("file"),
  JOB_BACKEND: z.enum(["file", "redis"]).default("file"),
  LLM_PROVIDER: z.string().default("gemini"),
  TOOL_RESULT_VERBOSITY: z.enum(["compact", "verbose"]).default("compact"),
  GEMINI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ADMIN_API_KEY: z.string().optional(),
  STATE_ENCRYPTION_KEY: z.string().optional(),
  API_VERSION: z.string().default("1.0.0"),
  MIN_SUPPORTED_APP_VERSION: z.string().optional(),
  ALLOWED_RETURN_TO_PREFIXES: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1, "GOOGLE_OAUTH_CLIENT_ID is required"),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1, "GOOGLE_OAUTH_CLIENT_SECRET is required"),
  GOOGLE_OAUTH_REDIRECT_URI: z
    .string()
    .default("http://127.0.0.1:42813/oauth/callback"),
  GOOGLE_OAUTH_API_REDIRECT_URI: z
    .string()
    .default("http://127.0.0.1:8787/api/v1/auth/google/callback"),
  CONTEXT_WINDOW_LIMIT: z.coerce.number().positive().default(128000),
  MAX_OUTPUT_TOKENS: z.coerce.number().positive().default(2000),
  COMPACTION_THRESHOLD: z.coerce.number().gt(0).lt(1).default(0.8),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(14),
  IDEMPOTENCY_TTL_HOURS: z.coerce.number().int().positive().default(24),
  JOB_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  JOB_RETRY_DELAY_MS: z.coerce.number().int().positive().default(30000),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(120),
  MAX_REQUEST_BODY_BYTES: z.coerce.number().int().positive().default(1024 * 1024),
  OPENAI_MODEL: z.string().default("gpt-5-mini"),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
});

export type AppConfig = {
  appEnv: "development" | "staging" | "production";
  storageBackend: "file" | "postgres";
  jobBackend: "file" | "redis";
  llmProvider: string;
  toolResultVerbosity: "compact" | "verbose";
  geminiApiKey?: string;
  groqApiKey?: string;
  openAiApiKey?: string;
  adminApiKey?: string;
  stateEncryptionKey?: string;
  apiVersion?: string;
  minSupportedAppVersion?: string;
  allowedReturnToPrefixes: string[];
  databaseUrl?: string;
  redisUrl?: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  googleApiRedirectUri: string;
  contextWindowLimit: number;
  maxOutputTokens: number;
  compactionThreshold: number;
  sessionTtlDays: number;
  idempotencyTtlHours: number;
  jobMaxAttempts: number;
  jobRetryDelayMs: number;
  workerPollIntervalMs: number;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  maxRequestBodyBytes: number;
  openAiModel: string;
  geminiModel: string;
  groqModel: string;
  rootDir: string;
  privateDir: string;
};

export function loadConfig(rootDir = process.cwd()): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }

  const env = parsed.data;
  if (env.APP_ENV !== "development" && !env.STATE_ENCRYPTION_KEY) {
    throw new Error("Invalid environment configuration:\nSTATE_ENCRYPTION_KEY is required outside development");
  }
  if (env.STORAGE_BACKEND !== "file" && !env.DATABASE_URL) {
    throw new Error("Invalid environment configuration:\nDATABASE_URL is required when STORAGE_BACKEND is not file");
  }
  if (env.JOB_BACKEND !== "file" && !env.REDIS_URL) {
    throw new Error("Invalid environment configuration:\nREDIS_URL is required when JOB_BACKEND is not file");
  }

  return {
    appEnv: env.APP_ENV,
    storageBackend: env.STORAGE_BACKEND,
    jobBackend: env.JOB_BACKEND,
    llmProvider: env.LLM_PROVIDER,
    toolResultVerbosity: env.TOOL_RESULT_VERBOSITY,
    geminiApiKey: env.GEMINI_API_KEY,
    groqApiKey: env.GROQ_API_KEY,
    openAiApiKey: env.OPENAI_API_KEY,
    adminApiKey: env.ADMIN_API_KEY,
    stateEncryptionKey: env.STATE_ENCRYPTION_KEY,
    apiVersion: env.API_VERSION,
    minSupportedAppVersion: env.MIN_SUPPORTED_APP_VERSION,
    allowedReturnToPrefixes: env.ALLOWED_RETURN_TO_PREFIXES?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [],
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    googleClientId: env.GOOGLE_OAUTH_CLIENT_ID,
    googleClientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    googleRedirectUri: env.GOOGLE_OAUTH_REDIRECT_URI,
    googleApiRedirectUri: env.GOOGLE_OAUTH_API_REDIRECT_URI,
    contextWindowLimit: env.CONTEXT_WINDOW_LIMIT,
    maxOutputTokens: env.MAX_OUTPUT_TOKENS,
    compactionThreshold: env.COMPACTION_THRESHOLD,
    sessionTtlDays: env.SESSION_TTL_DAYS,
    idempotencyTtlHours: env.IDEMPOTENCY_TTL_HOURS,
    jobMaxAttempts: env.JOB_MAX_ATTEMPTS,
    jobRetryDelayMs: env.JOB_RETRY_DELAY_MS,
    workerPollIntervalMs: env.WORKER_POLL_INTERVAL_MS,
    rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    maxRequestBodyBytes: env.MAX_REQUEST_BODY_BYTES,
    openAiModel: env.OPENAI_MODEL,
    geminiModel: env.GEMINI_MODEL,
    groqModel: env.GROQ_MODEL,
    rootDir,
    privateDir: path.join(rootDir, ".opencal"),
  };
}
