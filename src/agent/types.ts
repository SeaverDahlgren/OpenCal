export type MessageRole = "system" | "user" | "assistant" | "tool";

export type ConversationMessage = {
  role: MessageRole;
  content: string;
  name?: string;
  timestamp: string;
};

export type ToolCall = {
  name: string;
  arguments: Record<string, unknown>;
};

export type AgentDecision =
  | { type: "message"; message: string }
  | { type: "clarify"; message: string }
  | { type: "tool"; reasoning: string; toolCalls: ToolCall[] }
  | { type: "stop"; message: string };

export type RuntimeContext = {
  nowIso: string;
  dayOfWeek: string;
  timezone: string;
  compactedSummary?: string;
};
