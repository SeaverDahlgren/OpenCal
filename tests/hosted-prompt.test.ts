import { describe, expect, it } from "vitest";
import { buildHostedSystemPrompt } from "../src/agent/prompts.js";

describe("hosted system prompt", () => {
  it("uses production context labels instead of markdown file labels", () => {
    const prompt = buildHostedSystemPrompt({
      systemContext: "You are OpenCal.",
      tools: [],
      skillsCatalog: "No semantic skills are configured.",
      selectedSkillDetails: [],
      taskStateSummary: "task_id: task-1",
      memoryContext: "- summary: Durable user profile context\n  content: current_interests: AI agents",
      profileContext: "- user_name: Avery",
      runtime: {
        nowIso: "2026-04-02T21:00:00.000Z",
        dayOfWeek: "Thursday",
        timezone: "America/Los_Angeles",
      },
      tokenUsage: {
        estimatedInputTokens: 100,
        contextWindowLimit: 128000,
        maxOutputTokens: 2000,
        compactionThreshold: 0.8,
      },
    });

    expect(prompt).toContain("Production personalization:");
    expect(prompt).toContain("Durable production memory:");
    expect(prompt).not.toContain("SOUL.md:");
    expect(prompt).not.toContain("USER.md:");
    expect(prompt).not.toContain("Memory.md:");
  });
});
