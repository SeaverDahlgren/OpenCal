import path from "node:path";
import { config as loadDotEnv } from "dotenv";
import { z } from "zod";

loadDotEnv();

const envSchema = z.object({
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  LLM_PROVIDER: z.string().default("gemini"),
  TOOL_RESULT_VERBOSITY: z.enum(["compact", "verbose"]).default("compact"),
  GEMINI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
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
  OPENAI_MODEL: z.string().default("gpt-5-mini"),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
});

export type AppConfig = {
  appEnv: "development" | "staging" | "production";
  llmProvider: string;
  toolResultVerbosity: "compact" | "verbose";
  geminiApiKey?: string;
  groqApiKey?: string;
  openAiApiKey?: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  googleApiRedirectUri: string;
  contextWindowLimit: number;
  maxOutputTokens: number;
  compactionThreshold: number;
  sessionTtlDays: number;
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

  return {
    appEnv: env.APP_ENV,
    llmProvider: env.LLM_PROVIDER,
    toolResultVerbosity: env.TOOL_RESULT_VERBOSITY,
    geminiApiKey: env.GEMINI_API_KEY,
    groqApiKey: env.GROQ_API_KEY,
    openAiApiKey: env.OPENAI_API_KEY,
    googleClientId: env.GOOGLE_OAUTH_CLIENT_ID,
    googleClientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    googleRedirectUri: env.GOOGLE_OAUTH_REDIRECT_URI,
    googleApiRedirectUri: env.GOOGLE_OAUTH_API_REDIRECT_URI,
    contextWindowLimit: env.CONTEXT_WINDOW_LIMIT,
    maxOutputTokens: env.MAX_OUTPUT_TOKENS,
    compactionThreshold: env.COMPACTION_THRESHOLD,
    sessionTtlDays: env.SESSION_TTL_DAYS,
    openAiModel: env.OPENAI_MODEL,
    geminiModel: env.GEMINI_MODEL,
    groqModel: env.GROQ_MODEL,
    rootDir,
    privateDir: path.join(rootDir, ".opencal"),
  };
}
