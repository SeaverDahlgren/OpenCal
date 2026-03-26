import type { StoredSessionState } from "../../../../src/app/session-types.js";

export function resolveUserTimezone(userMarkdown = "") {
  return userMarkdown.match(/timezone:\s*([A-Za-z_\/]+)/i)?.[1] ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function resolveSystemTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function buildUtcDayBounds(date: string) {
  return {
    timeMin: `${date}T00:00:00.000Z`,
    timeMax: `${date}T23:59:59.999Z`,
  };
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
          prompt: `Please confirm: should I ${summarizeConfirmationAction(
            session.pendingConfirmation.toolName,
            session.pendingConfirmation.arguments,
          )}?`,
          actionLabel: "Confirm",
          cancelLabel: "Cancel",
          payloadPreview: {
            kind: session.pendingConfirmation.toolName,
            summary: summarizeConfirmationAction(
              session.pendingConfirmation.toolName,
              session.pendingConfirmation.arguments,
            ),
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

function summarizeConfirmationAction(toolName: string, input: Record<string, unknown>) {
  const summary = asString(input.summary);
  const subject = asString(input.subject);
  const title = summary || asString(input.title);
  const start = asString(input.start);
  const end = asString(input.end);

  if (toolName === "write_draft") {
    return subject ? `create the draft "${subject}"` : "create this email draft";
  }

  if (toolName === "create_event") {
    if (title && start) {
      return `create "${title}" starting at ${start}`;
    }
    return title ? `create "${title}"` : "create this event";
  }

  if (toolName === "update_event") {
    if (title && start) {
      return `update "${title}" to ${start}`;
    }
    return title ? `update "${title}"` : "update this event";
  }

  if (toolName === "delete_event") {
    return title ? `delete "${title}"` : "delete this event";
  }

  if (title && start && end) {
    return `${toolName.replace(/_/g, " ")} "${title}" from ${start} to ${end}`;
  }

  if (title && start) {
    return `${toolName.replace(/_/g, " ")} "${title}" at ${start}`;
  }

  if (title || subject) {
    return `${toolName.replace(/_/g, " ")} ${JSON.stringify(title || subject)}`;
  }

  return toolName.replace(/_/g, " ");
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
