import path from "node:path";
import { config as loadDotEnv } from "dotenv";
import { z } from "zod";

loadDotEnv();

const envSchema = z.object({
  LLM_PROVIDER: z.string().default("gemini"),
  GEMINI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1, "GOOGLE_OAUTH_CLIENT_ID is required"),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1, "GOOGLE_OAUTH_CLIENT_SECRET is required"),
  GOOGLE_OAUTH_REDIRECT_URI: z
    .string()
    .default("http://127.0.0.1:42813/oauth/callback"),
  CONTEXT_WINDOW_LIMIT: z.coerce.number().positive().default(128000),
  MAX_OUTPUT_TOKENS: z.coerce.number().positive().default(2000),
  COMPACTION_THRESHOLD: z.coerce.number().gt(0).lt(1).default(0.8),
  OPENAI_MODEL: z.string().default("gpt-5-mini"),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
});

export type AppConfig = {
  llmProvider: string;
  geminiApiKey?: string;
  groqApiKey?: string;
  openAiApiKey?: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  contextWindowLimit: number;
  maxOutputTokens: number;
  compactionThreshold: number;
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
    llmProvider: env.LLM_PROVIDER,
    geminiApiKey: env.GEMINI_API_KEY,
    groqApiKey: env.GROQ_API_KEY,
    openAiApiKey: env.OPENAI_API_KEY,
    googleClientId: env.GOOGLE_OAUTH_CLIENT_ID,
    googleClientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    googleRedirectUri: env.GOOGLE_OAUTH_REDIRECT_URI,
    contextWindowLimit: env.CONTEXT_WINDOW_LIMIT,
    maxOutputTokens: env.MAX_OUTPUT_TOKENS,
    compactionThreshold: env.COMPACTION_THRESHOLD,
    openAiModel: env.OPENAI_MODEL,
    geminiModel: env.GEMINI_MODEL,
    groqModel: env.GROQ_MODEL,
    rootDir,
    privateDir: path.join(rootDir, ".opencal"),
  };
}
