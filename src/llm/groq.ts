import { buildTranscript } from "../agent/prompts.js";
import { parseAgentDecision } from "../agent/json.js";
import type { ConversationMessage } from "../agent/types.js";
import type { LlmProvider, ProviderRequest } from "./provider.js";

type GroqChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: unknown;
};

export class GroqProvider implements LlmProvider {
  readonly name = "groq";

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async generateDecision(request: ProviderRequest) {
    const text = await this.complete(
      [
        {
          role: "system",
          content: request.systemPrompt,
        },
        {
          role: "user",
          content: `Conversation:\n${buildTranscript(request.messages)}`,
        },
      ],
      request.maxOutputTokens,
      true,
    );

    return parseAgentDecision(text);
  }

  async summarizeConversation(messages: ConversationMessage[]) {
    return this.complete(
      [
        {
          role: "system",
          content: [
            "Summarize this chat into durable user memory.",
            "Constraints:",
            "- Include only facts/preferences explicitly stated by the user in chat.",
            "- Exclude facts learned only from Gmail or Calendar tool output.",
            "- Keep it under 8 bullets.",
          ].join("\n"),
        },
        {
          role: "user",
          content: buildTranscript(messages),
        },
      ],
      400,
      false,
    );
  }

  private async complete(
    messages: Array<{ role: "system" | "user"; content: string }>,
    maxCompletionTokens: number,
    jsonMode: boolean,
  ): Promise<string> {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.2,
        max_completion_tokens: maxCompletionTokens,
        ...(jsonMode
          ? {
              response_format: {
                type: "json_object",
              },
            }
          : {}),
      }),
    });

    const rawText = await response.text();
    const payload = tryParseGroqJson(rawText);

    if (!response.ok) {
      throw new Error(JSON.stringify(payload ?? { error: { status: response.status, message: rawText } }));
    }

    const content = payload?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("Groq returned an empty response");
    }

    return content;
  }
}

function tryParseGroqJson(rawText: string): GroqChatResponse | null {
  try {
    return JSON.parse(rawText) as GroqChatResponse;
  } catch {
    return null;
  }
}
