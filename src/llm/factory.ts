import type { AppConfig } from "../config/env.js";
import type { LlmProvider } from "./provider.js";
import { GeminiProvider } from "./gemini.js";

export function createLlmProvider(config: AppConfig): LlmProvider {
  switch (config.llmProvider) {
    case "gemini":
      if (!config.geminiApiKey) {
        throw new Error("GEMINI_API_KEY is required when LLM_PROVIDER=gemini");
      }
      return new GeminiProvider(config.geminiApiKey, config.geminiModel);
    default:
      throw new Error(
        `Unsupported LLM_PROVIDER "${config.llmProvider}". Implement an adapter in src/llm/.`,
      );
  }
}
