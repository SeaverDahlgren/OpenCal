import type { AgentDecision } from "./types.js";

export function extractJsonPayload(raw: string): string {
  const trimmed = raw.trim();

  if (trimmed.startsWith("{")) {
    return trimmed;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    return fenced[1].trim();
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  throw new Error("Model response did not contain JSON");
}

export function parseAgentDecision(raw: string): AgentDecision {
  const payload = extractJsonPayload(raw);
  const parsed = JSON.parse(payload) as Partial<AgentDecision> & {
    toolCalls?: Array<{ name?: string; arguments?: Record<string, unknown> }>;
  };

  if (parsed.type === "message" && typeof parsed.message === "string") {
    return { type: "message", message: parsed.message };
  }

  if (parsed.type === "clarify" && typeof parsed.message === "string") {
    return { type: "clarify", message: parsed.message };
  }

  if (
    parsed.type === "tool" &&
    typeof parsed.reasoning === "string" &&
    Array.isArray(parsed.toolCalls)
  ) {
    return {
      type: "tool",
      reasoning: parsed.reasoning,
      toolCalls: parsed.toolCalls.map((toolCall) => ({
        name: toolCall.name ?? "",
        arguments: toolCall.arguments ?? {},
      })),
    };
  }

  if (parsed.type === "stop" && typeof parsed.message === "string") {
    return { type: "stop", message: parsed.message };
  }

  throw new Error(`Invalid agent decision payload: ${payload}`);
}
