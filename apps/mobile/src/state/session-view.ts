import type { AgentTurnDto, SessionDto, TaskStateDto } from "../api/types";

export type AgentActionInput = {
  message?: string;
  action?: "confirm" | "cancel";
  optionValue?: string;
};

export function derivePendingTurn(taskState: TaskStateDto | null): AgentTurnDto | null {
  if (!taskState?.clarification && !taskState?.confirmation) {
    return null;
  }

  return {
    assistant: {
      message:
        taskState.clarification?.prompt ??
        taskState.confirmation?.prompt ??
        taskState.taskState?.summary ??
        "Resume your task.",
    },
    clarification: taskState.clarification,
    confirmation: taskState.confirmation,
    session: {
      hasBlockedTask: Boolean(taskState.taskState?.hasBlockedPrompt || taskState.confirmation),
    },
  };
}

export function hasBlockedUiState(session: SessionDto["session"] | null, pendingTurn: AgentTurnDto | null) {
  return Boolean(pendingTurn?.clarification || pendingTurn?.confirmation || session?.hasBlockedTask);
}
