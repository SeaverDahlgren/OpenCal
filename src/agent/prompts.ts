import type { ConversationMessage, RuntimeContext } from "./types.js";
import type { ToolPromptShape } from "../tools/types.js";

export function buildSystemPrompt(args: {
  soul: string;
  user: string;
  tools: ToolPromptShape[];
  skillsCatalog: string;
  selectedSkillDetails: string[];
  memory: string;
  runtime: RuntimeContext;
  tokenUsage: {
    estimatedInputTokens: number;
    contextWindowLimit: number;
    maxOutputTokens: number;
    compactionThreshold: number;
  };
}): string {
  const { soul, user, tools, skillsCatalog, selectedSkillDetails, memory, runtime, tokenUsage } = args;
  const toolBlock = tools
    .map(
      (tool) =>
        `- ${tool.name}${tool.protected ? " [protected]" : ""}: ${tool.description}\n  input: ${tool.inputShape}`,
    )
    .join("\n");

  return [
    "You are a CLI Calendar and Gmail agent using a recursive planning loop.",
    "",
    "Operating rules:",
    "- Be concise and candid.",
    "- Use tools when needed; do not hallucinate Gmail or Calendar state.",
    "- Use semantic skills to generalize intent before choosing literal tool arguments.",
    "- If timing or entity selection is ambiguous, ask for clarification instead of guessing.",
    "- Protected actions must be previewed and confirmed by the human before execution.",
    "- Offer time-management advice only when directly relevant to the request.",
    "- Final responses should be user-facing and short.",
    "",
    "Return only valid JSON matching one of these shapes:",
    '{"type":"message","message":"..."}',
    '{"type":"clarify","message":"..."}',
    '{"type":"tool","reasoning":"short note","toolCalls":[{"name":"tool_name","arguments":{}}]}',
    '{"type":"stop","message":"<STOP> final answer"}',
    "",
    "Available tools:",
    toolBlock,
    "",
    "Available semantic skills:",
    skillsCatalog,
    "",
    "Selected skill details:",
    selectedSkillDetails.length > 0 ? selectedSkillDetails.join("\n\n---\n\n") : "No detailed skills selected for this turn.",
    "",
    "SOUL.md:",
    soul,
    "",
    "USER.md:",
    user,
    "",
    "Memory.md:",
    memory,
    "",
    "Runtime:",
    `- now: ${runtime.nowIso}`,
    `- day_of_week: ${runtime.dayOfWeek}`,
    `- timezone: ${runtime.timezone}`,
    runtime.compactedSummary
      ? `- compacted_summary: ${runtime.compactedSummary}`
      : "- compacted_summary: none",
    "",
    "Token budget:",
    `- estimated_input_tokens: ${tokenUsage.estimatedInputTokens}`,
    `- context_window_limit: ${tokenUsage.contextWindowLimit}`,
    `- max_output_tokens: ${tokenUsage.maxOutputTokens}`,
    `- compaction_threshold: ${tokenUsage.compactionThreshold}`,
  ].join("\n");
}

export function buildTranscript(messages: ConversationMessage[]): string {
  return messages
    .map((message) => {
      const name = message.name ? `:${message.name}` : "";
      return `[${message.timestamp}] ${message.role}${name}: ${message.content}`;
    })
    .join("\n");
}
