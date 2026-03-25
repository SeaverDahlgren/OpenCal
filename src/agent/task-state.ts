export type TaskSubgoalStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type TaskSubgoalKind = "calendar" | "email" | "clarification" | "general";
export type AwaitingUserResponseKind = "clarification" | "followup";

export type TaskSubgoal = {
  id: string;
  description: string;
  status: TaskSubgoalStatus;
  kind: TaskSubgoalKind;
  completionMode: "tool" | "response";
  blockingInputs: string[];
  relatedTools: string[];
  resultSummary?: string;
};

export type AwaitingUserResponse = {
  prompt: string;
  appliesToSubgoalIds: string[];
  responseKind: AwaitingUserResponseKind;
};

export type TaskState = {
  taskId: string;
  taskSummary: string;
  subgoals: TaskSubgoal[];
  awaitingUserResponse?: AwaitingUserResponse;
  lastResolvedAt: string;
};

export function createTaskState(userInput: string, now = new Date()): TaskState {
  return {
    taskId: `task-${now.getTime()}`,
    taskSummary: userInput.trim(),
    subgoals: inferSubgoals(userInput),
    lastResolvedAt: now.toISOString(),
  };
}

export function shouldStartNewTask(taskState: TaskState | null, userInput: string): boolean {
  if (!taskState) {
    return true;
  }

  const normalized = normalizeText(userInput);
  if (!normalized) {
    return false;
  }

  if (taskState.awaitingUserResponse && looksLikeFollowUpReply(normalized)) {
    return false;
  }

  if (looksLikeContinuation(normalized)) {
    return false;
  }

  const pendingTokens = tokenize(
    [
      taskState.taskSummary,
      ...taskState.subgoals
        .filter((subgoal) => subgoal.status === "pending" || subgoal.status === "in_progress")
        .map((subgoal) => subgoal.description),
    ].join(" "),
  );

  const inputTokens = [...tokenize(normalized)];
  const overlap = inputTokens.filter((token) => pendingTokens.has(token));
  return overlap.length === 0;
}

export function mergeUserInputIntoTaskState(
  taskState: TaskState,
  userInput: string,
  now = new Date(),
): TaskState {
  const next = cloneTaskState(taskState);
  next.taskSummary = summarizeTask(taskState.taskSummary, userInput);
  next.lastResolvedAt = now.toISOString();

  for (const inferredSubgoal of inferSubgoals(userInput)) {
    const exists = next.subgoals.some(
      (subgoal) =>
        subgoal.kind === inferredSubgoal.kind &&
        normalizeText(subgoal.description) === normalizeText(inferredSubgoal.description),
    );
    if (!exists) {
      next.subgoals.push(inferredSubgoal);
    }
  }

  return next;
}

export function bindUserReplyToTaskState(
  taskState: TaskState,
  userInput: string,
  now = new Date(),
): TaskState {
  const next = mergeUserInputIntoTaskState(taskState, userInput, now);
  next.awaitingUserResponse = undefined;
  return next;
}

export function registerAwaitingUserResponse(
  taskState: TaskState,
  prompt: string,
  responseKind: AwaitingUserResponseKind,
  subgoalIds: string[],
  now = new Date(),
): TaskState {
  const next = cloneTaskState(taskState);
  next.awaitingUserResponse = {
    prompt,
    appliesToSubgoalIds: subgoalIds,
    responseKind,
  };
  next.lastResolvedAt = now.toISOString();

  for (const subgoal of next.subgoals) {
    if (subgoalIds.includes(subgoal.id) && subgoal.status === "pending") {
      subgoal.status = "in_progress";
      pushUnique(subgoal.blockingInputs, prompt);
    }
  }

  return next;
}

export function markSubgoalsInProgress(
  taskState: TaskState,
  toolNames: string[],
  now = new Date(),
): TaskState {
  const next = cloneTaskState(taskState);
  next.lastResolvedAt = now.toISOString();

  for (const toolName of toolNames) {
    const kind = toolKind(toolName);
    for (const subgoal of next.subgoals) {
      if (subgoal.kind === kind && subgoal.status === "pending") {
        subgoal.status = "in_progress";
      }
      if (subgoal.kind === kind) {
        pushUnique(subgoal.relatedTools, toolName);
      }
    }
  }

  return next;
}

export function applyToolOutcome(
  taskState: TaskState,
  toolName: string,
  outcome: "success" | "error" | "cancelled",
  detail: string,
  now = new Date(),
): TaskState {
  const next = cloneTaskState(taskState);
  next.lastResolvedAt = now.toISOString();
  const kind = toolKind(toolName);

  const target = next.subgoals.find(
    (subgoal) =>
      subgoal.kind === kind &&
      (subgoal.status === "in_progress" || subgoal.status === "pending"),
  );

  if (!target) {
    return next;
  }

  pushUnique(target.relatedTools, toolName);

  if (outcome === "success" && completesSubgoal(toolName)) {
    target.status = "completed";
    target.resultSummary = detail;
    target.blockingInputs = [];
    return next;
  }

  if (outcome === "cancelled") {
    target.status = "cancelled";
    target.resultSummary = detail;
    return next;
  }

  if (outcome === "error") {
    target.status = "in_progress";
    target.resultSummary = detail;
  }

  return next;
}

export function summarizeTaskStateForPrompt(taskState: TaskState | null): string {
  if (!taskState) {
    return "No active task state.";
  }

  const pending = taskState.subgoals
    .filter((subgoal) => subgoal.status === "pending" || subgoal.status === "in_progress")
    .map((subgoal) => `- ${subgoal.status}: ${subgoal.description}`)
    .join("\n");

  const completed = taskState.subgoals
    .filter((subgoal) => subgoal.status === "completed")
    .map((subgoal) => `- completed: ${subgoal.description}${subgoal.resultSummary ? ` (${subgoal.resultSummary})` : ""}`)
    .join("\n");

  return [
    `task_id: ${taskState.taskId}`,
    `task_summary: ${taskState.taskSummary}`,
    "pending_subgoals:",
    pending || "- none",
    "completed_subgoals:",
    completed || "- none",
    taskState.awaitingUserResponse
      ? `awaiting_user_response: ${taskState.awaitingUserResponse.prompt} [${taskState.awaitingUserResponse.responseKind}]`
      : "awaiting_user_response: none",
  ].join("\n");
}

export function hasPendingSubgoals(taskState: TaskState | null): boolean {
  return (
    taskState?.subgoals.some(
      (subgoal) =>
        subgoal.completionMode === "tool" &&
        (subgoal.status === "pending" || subgoal.status === "in_progress"),
    ) ?? false
  );
}

export function isWaitingForUserResponse(taskState: TaskState | null): boolean {
  return Boolean(taskState?.awaitingUserResponse);
}

export function buildTaskSkillSelectionInput(taskState: TaskState | null, latestUserInput: string): string {
  if (!taskState) {
    return latestUserInput;
  }

  const pendingDescriptions = taskState.subgoals
    .filter((subgoal) => subgoal.status === "pending" || subgoal.status === "in_progress")
    .map((subgoal) => subgoal.description)
    .join(". ");

  return [taskState.taskSummary, pendingDescriptions, latestUserInput].filter(Boolean).join(". ");
}

export function buildIncompleteTaskMessage(taskState: TaskState | null): string {
  if (!taskState) {
    return "I still have unfinished work for that request.";
  }

  const pending = taskState.subgoals
    .filter(
      (subgoal) =>
        subgoal.completionMode === "tool" &&
        (subgoal.status === "pending" || subgoal.status === "in_progress"),
    )
    .map((subgoal) => subgoal.description);

  if (pending.length === 0) {
    return "I still have unfinished work for that request.";
  }

  return `I still have pending work: ${pending.join("; ")}.`;
}

export function completeResponseSubgoals(
  taskState: TaskState | null,
  detail: string,
  now = new Date(),
): TaskState | null {
  if (!taskState) {
    return null;
  }

  const next = cloneTaskState(taskState);
  next.lastResolvedAt = now.toISOString();

  for (const subgoal of next.subgoals) {
    if (
      subgoal.completionMode === "response" &&
      (subgoal.status === "pending" || subgoal.status === "in_progress")
    ) {
      subgoal.status = "completed";
      subgoal.resultSummary = detail;
      subgoal.blockingInputs = [];
    }
  }

  return next;
}

function inferSubgoals(userInput: string): TaskSubgoal[] {
  const normalized = normalizeText(userInput);
  const subgoals: TaskSubgoal[] = [];
  const people = extractPeopleList(userInput);
  const wantsCalendar = /\b(meeting|meetings|schedule|resched|calendar|event|slot|availability|free busy|find time)\b/i.test(
    normalized,
  );
  const wantsEmail = /\b(email|draft|message|reply|share)\b/i.test(normalized);

  if (wantsCalendar && people.length > 0) {
    people.forEach((person, index) => {
      subgoals.push(createSubgoal(`calendar-${index + 1}`, `Schedule meeting with ${person}`, "calendar", "tool"));
    });
  } else if (wantsCalendar) {
    const completionMode = requiresCalendarMutation(normalized) ? "tool" : "response";
    subgoals.push(
      createSubgoal("calendar-1", "Complete the calendar scheduling request", "calendar", completionMode),
    );
  }

  if (wantsEmail) {
    const emailDescription = /\bshare\b/i.test(normalized)
      ? "Draft a shareable email"
      : "Draft the requested email";
    subgoals.push(createSubgoal("email-1", emailDescription, "email", "tool"));
  }

  if (subgoals.length === 0) {
    subgoals.push(createSubgoal("general-1", "Complete the current request", "general", "response"));
  }

  return subgoals;
}

function createSubgoal(
  id: string,
  description: string,
  kind: TaskSubgoalKind,
  completionMode: "tool" | "response",
): TaskSubgoal {
  return {
    id,
    description,
    status: "pending",
    kind,
    completionMode,
    blockingInputs: [],
    relatedTools: [],
  };
}

function summarizeTask(currentSummary: string, userInput: string) {
  const normalizedCurrent = normalizeText(currentSummary);
  const normalizedInput = normalizeText(userInput);
  if (!normalizedInput || normalizedCurrent.includes(normalizedInput)) {
    return currentSummary;
  }

  if (looksLikeFollowUpReply(normalizedInput)) {
    return currentSummary;
  }

  return `${currentSummary} Follow-up: ${userInput.trim()}`;
}

function extractPeopleList(userInput: string) {
  const withMatch = userInput.match(/\bwith\s+([^.!?\n]+)/i);
  if (!withMatch) {
    return [];
  }

  const candidateBlock = withMatch[1].split(/\bthen\b|\bso\b|\bbecause\b/i)[0] ?? withMatch[1];

  return candidateBlock
    .split(/,|\band\b/gi)
    .map((value) => value.trim())
    .map((value) => value.replace(/^(the|a)\s+/i, ""))
    .filter((value) => /^[A-Za-z][A-Za-z .'-]*$/.test(value));
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function tokenize(value: string) {
  const stopWords = new Set([
    "a",
    "an",
    "and",
    "for",
    "i",
    "it",
    "my",
    "of",
    "please",
    "the",
    "to",
    "with",
    "you",
  ]);

  return new Set(
    normalizeText(value)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2 && !stopWords.has(token)),
  );
}

function looksLikeFollowUpReply(value: string) {
  return /^(yes|y|ok|okay|sure|sounds good|that works|go ahead|do it|use the first one|use the second one|use the third one)\b/i.test(
    value,
  );
}

function looksLikeContinuation(value: string) {
  return looksLikeFollowUpReply(value) || /^(also|and|plus|one more thing)\b/i.test(value);
}

function toolKind(toolName: string): TaskSubgoalKind {
  if (
    [
      "search_events",
      "get_event",
      "list_calendars",
      "find_free_busy",
      "find_time_slots",
      "create_event",
      "update_event",
      "delete_event",
      "get_current_time",
    ].includes(toolName)
  ) {
    return "calendar";
  }

  if (["search_emails", "list_threads", "get_thread_details", "write_draft"].includes(toolName)) {
    return "email";
  }

  if (["resolve_entities", "clarify_time"].includes(toolName)) {
    return "clarification";
  }

  return "general";
}

function completesSubgoal(toolName: string) {
  return ["create_event", "update_event", "delete_event", "write_draft"].includes(toolName);
}

function requiresCalendarMutation(normalizedUserInput: string) {
  return /\b(schedule|resched|reschedule|move|book|create|delete|cancel)\b/i.test(normalizedUserInput);
}

function cloneTaskState(taskState: TaskState): TaskState {
  return {
    ...taskState,
    subgoals: taskState.subgoals.map((subgoal) => ({
      ...subgoal,
      blockingInputs: [...subgoal.blockingInputs],
      relatedTools: [...subgoal.relatedTools],
    })),
    awaitingUserResponse: taskState.awaitingUserResponse
      ? {
          ...taskState.awaitingUserResponse,
          appliesToSubgoalIds: [...taskState.awaitingUserResponse.appliesToSubgoalIds],
        }
      : undefined,
  };
}

function pushUnique(values: string[], value: string) {
  if (value && !values.includes(value)) {
    values.push(value);
  }
}
