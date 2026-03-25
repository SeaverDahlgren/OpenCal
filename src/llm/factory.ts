import type { AppConfig } from "../config/env.js";
import type { LlmProvider } from "./provider.js";
import { GeminiProvider } from "./gemini.js";
import { GroqProvider } from "./groq.js";

export function createLlmProvider(config: AppConfig): LlmProvider {
  switch (config.llmProvider) {
    case "gemini":
      if (!config.geminiApiKey) {
        throw new Error("GEMINI_API_KEY is required when LLM_PROVIDER=gemini");
      }
      return new GeminiProvider(config.geminiApiKey, config.geminiModel);
    case "groq":
      if (!config.groqApiKey) {
        throw new Error("GROQ_API_KEY is required when LLM_PROVIDER=groq");
      }
      return new GroqProvider(config.groqApiKey, config.groqModel);
    default:
      throw new Error(
        `Unsupported LLM_PROVIDER "${config.llmProvider}". Implement an adapter in src/llm/.`,
      );
  }
}
