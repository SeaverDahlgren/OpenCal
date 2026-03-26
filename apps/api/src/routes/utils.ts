import type { StoredSessionState } from "../../../../src/app/session-types.js";

export function resolveUserTimezone(userMarkdown = "") {
  return userMarkdown.match(/timezone:\s*([A-Za-z_\/]+)/i)?.[1] ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function resolveSystemTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function buildTaskStateRoutePayload(session: StoredSessionState) {
  return {
    taskState: session.taskState
      ? {
          taskId: session.taskState.taskId,
          summary: session.taskState.taskSummary,
          status: session.taskState.mode,
          activeSubgoal: session.taskState.activeSubgoalId,
          hasBlockedPrompt: Boolean(session.taskState.awaitingUserResponse),
        }
      : null,
    clarification: session.taskState?.awaitingUserResponse
      ? {
          type: session.taskState.awaitingUserResponse.options?.length ? "choice" : "freeform",
          prompt: session.taskState.awaitingUserResponse.prompt,
          options: (session.taskState.awaitingUserResponse.options ?? []).map((option, index) => ({
            id: String(index + 1),
            label: option.summary,
            value: option.value,
          })),
        }
      : null,
    confirmation: session.pendingConfirmation
      ? {
          type: "protected_action",
          prompt: `Confirm ${session.pendingConfirmation.toolName.replace(/_/g, " ")}.`,
          actionLabel: "Confirm",
          cancelLabel: "Cancel",
          payloadPreview: {
            kind: session.pendingConfirmation.toolName,
            raw: session.pendingConfirmation.arguments,
          },
        }
      : null,
  };
}

export function buildChatHistoryRoutePayload(session: StoredSessionState) {
  return {
    messages: session.messages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .slice(-100)
      .map((message, index) => ({
        id: `${message.timestamp}-${message.role}-${index}`,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
      })),
  };
}

export function buildSessionRoutePayload(session: StoredSessionState, userMarkdown = "") {
  return {
    session: {
      sessionId: session.sessionId,
      status: "authenticated",
      user: session.user,
      timezone: resolveUserTimezone(userMarkdown) || resolveSystemTimezone(),
      hasBlockedTask: Boolean(session.taskState?.awaitingUserResponse || session.pendingConfirmation),
      activeTaskSummary: session.taskState?.taskSummary ?? "",
    },
  };
}
