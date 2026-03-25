import { GoogleGenAI } from "@google/genai";
import { buildTranscript } from "../agent/prompts.js";
import { parseAgentDecision } from "../agent/json.js";
import type { ConversationMessage } from "../agent/types.js";
import type { LlmProvider, ProviderRequest } from "./provider.js";

export class GeminiProvider implements LlmProvider {
  readonly name = "gemini";
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateDecision(request: ProviderRequest) {
    const prompt = [
      request.systemPrompt,
      "",
      "Conversation:",
      buildTranscript(request.messages),
    ].join("\n");

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        temperature: 0.2,
        maxOutputTokens: request.maxOutputTokens,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned an empty response");
    }

    return parseAgentDecision(text);
  }

  async summarizeConversation(messages: ConversationMessage[]) {
    const prompt = [
      "Summarize this chat into durable user memory.",
      "Constraints:",
      "- Include only facts/preferences explicitly stated by the user in chat.",
      "- Exclude facts learned only from Gmail or Calendar tool output.",
      "- Keep it under 8 bullets.",
      "",
      buildTranscript(messages),
    ].join("\n");

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        temperature: 0.1,
        maxOutputTokens: 400,
      },
    });

    return response.text?.trim() ?? "";
  }
}
