import { describe, expect, it } from "vitest";
import { compactConversation } from "../src/memory/context.js";
import type { ConversationMessage } from "../src/agent/types.js";
import type { LlmProvider } from "../src/llm/provider.js";
import type { ProviderRequest } from "../src/llm/provider.js";

class FakeProvider implements LlmProvider {
  readonly name = "fake";

  async generateDecision(_request: ProviderRequest) {
    return {
      type: "message" as const,
      message: "unused",
    };
  }

  async summarizeConversation() {
    return "summary";
  }
}

describe("compactConversation", () => {
  it("replaces older messages with a summary when threshold is crossed", async () => {
    const messages: ConversationMessage[] = Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: "x".repeat(120),
      timestamp: new Date(0).toISOString(),
    }));

    const result = await compactConversation({
      messages,
      contextWindowLimit: 100,
      compactionThreshold: 0.8,
      provider: new FakeProvider(),
    });

    expect(result.summary).toBe("summary");
    expect(result.messages[0].content).toContain("summary");
    expect(result.messages).toHaveLength(9);
  });
});
