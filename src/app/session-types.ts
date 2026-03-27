import type { ConversationMessage } from "../agent/types.js";
import type { TaskState, TaskArtifact } from "../agent/task-state.js";

export type AppChoiceOption = {
  id: string;
  label: string;
  value: string;
};

export type ClarificationPrompt = {
  type: "choice" | "freeform";
  prompt: string;
  options: AppChoiceOption[];
};

export type ConfirmationPrompt = {
  type: "protected_action";
  prompt: string;
  actionLabel: string;
  cancelLabel: string;
  payloadPreview: {
    kind: string;
    title?: string;
    summary?: string;
    oldTime?: string;
    newTime?: string;
    calendarId?: string;
    subject?: string;
    recipients?: string[];
    body?: string;
    raw: Record<string, unknown>;
  };
};

export type TaskStateSummary = {
  taskId: string;
  summary: string;
  status: "idle" | "planning" | "executing" | "blocked";
  activeSubgoal?: string;
  hasBlockedPrompt: boolean;
};

export type AssistantTurnPayload = {
  assistant: {
    message: string;
  };
  taskState: TaskStateSummary;
  clarification: ClarificationPrompt | null;
  confirmation: ConfirmationPrompt | null;
  artifacts: Array<{
    key: string;
    type: string;
    summary: string;
  }>;
  session: {
    hasBlockedTask: boolean;
  };
};

export type AgentActionRequest =
  | { type: "message"; message: string }
  | { type: "select_option"; value: string }
  | { type: "confirm" }
  | { type: "cancel" };

export type PendingConfirmation = {
  toolName: string;
  arguments: Record<string, unknown>;
};

export type StoredSessionState = {
  sessionId: string;
  token: string;
  tokenHash?: string;
  expiresAt: string;
  user: {
    name: string;
    email: string;
  };
  provider: string;
  model: string;
  toolResultVerbosity: "compact" | "verbose";
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
  taskState: TaskState | null;
  pendingConfirmation: PendingConfirmation | null;
};

export type SessionStateFile = {
  currentSessionId?: string;
  sessions: Record<string, StoredSessionState>;
};

export function summarizeArtifacts(artifacts: TaskArtifact[]) {
  return artifacts.slice(-5).map((artifact) => ({
    key: artifact.key,
    type: artifact.type,
    summary: artifact.summary,
  }));
}
