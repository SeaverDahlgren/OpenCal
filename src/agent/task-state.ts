import type { ToolResult } from "../tools/types.js";

export type TaskMode = "planning" | "executing" | "blocked";
export type TaskSubgoalStatus = "pending" | "active" | "blocked" | "completed" | "cancelled";
export type TaskSubgoalKind = "calendar" | "email" | "clarification" | "general";
export type AwaitingUserResponseKind = "clarification" | "followup";

export type TaskArtifact = {
  key: string;
  type: string;
  value: unknown;
  summary: string;
  createdAt: string;
};

export type TaskSubgoal = {
  id: string;
  description: string;
  status: TaskSubgoalStatus;
  kind: TaskSubgoalKind;
  completionMode: "tool" | "response";
  relatedTools: string[];
  artifacts: TaskArtifact[];
  resultSummary?: string;
  blockingReason?: string;
};

export type AwaitingUserResponse = {
  prompt: string;
  subgoalId: string;
  responseKind: AwaitingUserResponseKind;
};

export type TaskState = {
  taskId: string;
  taskSummary: string;
  mode: TaskMode;
  subgoals: TaskSubgoal[];
  activeSubgoalId?: string;
  awaitingUserResponse?: AwaitingUserResponse;
  lastResolvedAt: string;
};

export function createTaskState(userInput: string, now = new Date()): TaskState {
  return {
    taskId: `task-${now.getTime()}`,
    taskSummary: userInput.trim(),
    mode: "planning",
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

  const taskTokens = tokenize(
    [
      taskState.taskSummary,
      getActiveSubgoal(taskState)?.description ?? "",
      ...taskState.subgoals
        .filter((subgoal) => subgoal.status === "pending" || subgoal.status === "active" || subgoal.status === "blocked")
        .map((subgoal) => subgoal.description),
    ].join(" "),
  );

  const inputTokens = [...tokenize(normalized)];
  return inputTokens.filter((token) => taskTokens.has(token)).length === 0;
}

export function mergeUserInputIntoTaskState(
  taskState: TaskState,
  userInput: string,
  now = new Date(),
): TaskState {
  const next = cloneTaskState(taskState);
  next.taskSummary = summarizeTask(taskState.taskSummary, userInput);
  next.lastResolvedAt = now.toISOString();

  for (const inferred of inferSubgoals(userInput)) {
    const exists = next.subgoals.some(
      (subgoal) =>
        subgoal.kind === inferred.kind &&
        normalizeText(subgoal.description) === normalizeText(inferred.description),
    );
    if (!exists) {
      next.subgoals.push(inferred);
    }
  }

  return next;
}

export function bindUserReplyToTaskState(
  taskState: TaskState,
  userInput: string,
  now = new Date(),
): TaskState {
  const next = cloneTaskState(taskState);
  next.taskSummary = summarizeTask(taskState.taskSummary, userInput);
  next.lastResolvedAt = now.toISOString();

  const active = getActiveSubgoal(next);
  if (active) {
    upsertArtifact(active, {
      key: "clarification_answer",
      type: "clarification_answer",
      value: userInput,
      summary: `User answered: ${userInput.trim()}`,
      createdAt: now.toISOString(),
    });

    if (hasArtifact(active, "candidate_slots")) {
      const selectedSlot = resolveSlotSelection(active, userInput, now);
      if (selectedSlot) {
        upsertArtifact(active, selectedSlot);
      }
    }

    active.status = "active";
    active.blockingReason = undefined;
  }

  next.awaitingUserResponse = undefined;
  next.mode = "planning";
  return next;
}

export function registerAwaitingUserResponse(
  taskState: TaskState,
  prompt: string,
  responseKind: AwaitingUserResponseKind,
  subgoalId: string,
  now = new Date(),
): TaskState {
  const next = cloneTaskState(taskState);
  const subgoal = getSubgoalById(next, subgoalId);
  next.lastResolvedAt = now.toISOString();
  next.awaitingUserResponse = {
    prompt,
    subgoalId,
    responseKind,
  };
  next.mode = "blocked";

  if (subgoal) {
    subgoal.status = "blocked";
    subgoal.blockingReason = prompt;
  }

  return next;
}

export function activateNextSubgoal(taskState: TaskState | null, now = new Date()): TaskState | null {
  if (!taskState) {
    return null;
  }

  const next = cloneTaskState(taskState);
  next.lastResolvedAt = now.toISOString();

  const current = getActiveSubgoal(next);
  if (current && (current.status === "active" || current.status === "blocked")) {
    return next;
  }

  const pending = next.subgoals.find((subgoal) => subgoal.status === "pending");
  if (!pending) {
    next.activeSubgoalId = undefined;
    next.mode = "planning";
    return next;
  }

  pending.status = "active";
  next.activeSubgoalId = pending.id;
  next.mode = "planning";
  return next;
}

export function beginExecution(
  taskState: TaskState,
  toolNames: string[],
  now = new Date(),
): TaskState {
  const next = cloneTaskState(taskState);
  const active = getActiveSubgoal(next);
  next.lastResolvedAt = now.toISOString();
  next.mode = "executing";

  if (active) {
    active.status = "active";
    for (const toolName of toolNames) {
      pushUnique(active.relatedTools, toolName);
    }
  }

  return next;
}

export function applyToolResultToTaskState(
  taskState: TaskState,
  toolName: string,
  result: ToolResult<unknown> | null,
  outcome: "success" | "error" | "cancelled",
  detail: string,
  now = new Date(),
): TaskState {
  const next = cloneTaskState(taskState);
  const active = getActiveSubgoal(next);
  next.lastResolvedAt = now.toISOString();

  if (!active) {
    next.mode = "planning";
    return next;
  }

  pushUnique(active.relatedTools, toolName);

  if (outcome === "cancelled") {
    active.status = "cancelled";
    active.resultSummary = detail;
    next.activeSubgoalId = undefined;
    next.mode = "planning";
    return next;
  }

  if (outcome === "error") {
    upsertArtifact(active, {
      key: `error:${toolName}`,
      type: "tool_error",
      value: detail,
      summary: detail,
      createdAt: now.toISOString(),
    });
    active.status = "active";
    next.mode = "planning";
    return next;
  }

  if (result?.ok) {
    upsertArtifact(active, buildArtifact(toolName, result.data, result.summary, now));

    if (toolName === "find_time_slots") {
      const slots = asRecordArray(result.data);
      if (slots.length === 1) {
        const onlySlot = slots[0];
        upsertArtifact(active, {
          key: "selected_slot",
          type: "selected_slot",
          value: onlySlot,
          summary: `Selected slot ${stringField(onlySlot, "start")} -> ${stringField(onlySlot, "end")}`,
          createdAt: now.toISOString(),
        });
        active.status = "active";
        next.mode = "planning";
        return next;
      }

      if (slots.length > 1) {
        const prompt = buildSlotPrompt(active.description, slots);
        active.status = "blocked";
        active.blockingReason = prompt;
        next.awaitingUserResponse = {
          prompt,
          subgoalId: active.id,
          responseKind: "clarification",
        };
        next.mode = "blocked";
        return next;
      }

      const prompt = `I couldn't find any valid time slots for ${active.description}. Do you want to widen the time window or change the duration?`;
      active.status = "blocked";
      active.blockingReason = prompt;
      next.awaitingUserResponse = {
        prompt,
        subgoalId: active.id,
        responseKind: "clarification",
      };
      next.mode = "blocked";
      return next;
    }

    if (completesSubgoal(toolName, active)) {
      active.status = "completed";
      active.resultSummary = detail;
      active.blockingReason = undefined;
      next.activeSubgoalId = undefined;
      next.awaitingUserResponse = undefined;
      next.mode = "planning";
      return next;
    }
  }

  active.status = "active";
  next.mode = "planning";
  return next;
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
  const active = getActiveSubgoal(next);
  next.lastResolvedAt = now.toISOString();

  if (!active || active.completionMode !== "response") {
    return next;
  }

  active.status = "completed";
  active.resultSummary = detail;
  upsertArtifact(active, {
    key: "response_output",
    type: "response_output",
    value: detail,
    summary: truncate(detail, 120),
    createdAt: now.toISOString(),
  });
  next.activeSubgoalId = undefined;
  next.awaitingUserResponse = undefined;
  next.mode = "planning";
  return next;
}

export function summarizeTaskStateForPrompt(taskState: TaskState | null): string {
  if (!taskState) {
    return "No active task state.";
  }

  const active = getActiveSubgoal(taskState);
  const pending = taskState.subgoals
    .filter((subgoal) => subgoal.status === "pending")
    .map((subgoal) => `- pending: ${subgoal.description}`)
    .join("\n");
  const completed = taskState.subgoals
    .filter((subgoal) => subgoal.status === "completed")
    .map((subgoal) => `- completed: ${subgoal.description}${subgoal.resultSummary ? ` (${subgoal.resultSummary})` : ""}`)
    .join("\n");
  const artifactBlock = active
    ? active.artifacts.slice(-5).map((artifact) => `- ${artifact.summary}`).join("\n")
    : "- none";

  return [
    `task_id: ${taskState.taskId}`,
    `mode: ${taskState.mode}`,
    `task_summary: ${taskState.taskSummary}`,
    `active_subgoal: ${active ? active.description : "none"}`,
    "active_artifacts:",
    artifactBlock,
    "pending_subgoals:",
    pending || "- none",
    "completed_subgoals:",
    completed || "- none",
    taskState.awaitingUserResponse
      ? `awaiting_user_response: ${taskState.awaitingUserResponse.prompt}`
      : "awaiting_user_response: none",
  ].join("\n");
}

export function hasPendingSubgoals(taskState: TaskState | null): boolean {
  return (
    taskState?.subgoals.some((subgoal) =>
      ["pending", "active", "blocked"].includes(subgoal.status),
    ) ?? false
  );
}

export function isBlocked(taskState: TaskState | null): boolean {
  return taskState?.mode === "blocked" && Boolean(taskState.awaitingUserResponse);
}

export function buildTaskSkillSelectionInput(taskState: TaskState | null, latestUserInput: string): string {
  if (!taskState) {
    return latestUserInput;
  }

  const active = getActiveSubgoal(taskState);
  return [
    taskState.taskSummary,
    active?.description ?? "",
    ...((active?.artifacts ?? []).slice(-3).map((artifact) => artifact.summary)),
    latestUserInput,
  ]
    .filter(Boolean)
    .join(". ");
}

export function buildIncompleteTaskMessage(taskState: TaskState | null): string {
  if (!taskState) {
    return "I still have unfinished work for that request.";
  }

  if (taskState.awaitingUserResponse) {
    return taskState.awaitingUserResponse.prompt;
  }

  const active = getActiveSubgoal(taskState);
  if (active) {
    return `I still need to finish: ${active.description}.`;
  }

  const pending = taskState.subgoals
    .filter((subgoal) => subgoal.status === "pending")
    .map((subgoal) => subgoal.description);

  return pending.length > 0
    ? `I still have pending work: ${pending.join("; ")}.`
    : "I still have unfinished work for that request.";
}

export function getActiveSubgoal(taskState: TaskState | null): TaskSubgoal | undefined {
  if (!taskState?.activeSubgoalId) {
    return undefined;
  }
  return taskState.subgoals.find((subgoal) => subgoal.id === taskState.activeSubgoalId);
}

export function getAwaitingPrompt(taskState: TaskState | null): string | undefined {
  return taskState?.awaitingUserResponse?.prompt;
}

export function hasSelectedSlot(taskState: TaskState | null): boolean {
  const active = getActiveSubgoal(taskState);
  return Boolean(active && hasArtifact(active, "selected_slot"));
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
    const description = /\bshare\b/i.test(normalized) ? "Draft a shareable email" : "Draft the requested email";
    subgoals.push(createSubgoal("email-1", description, "email", "tool"));
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
    relatedTools: [],
    artifacts: [],
  };
}

function buildArtifact(toolName: string, data: unknown, summary: string, now: Date): TaskArtifact {
  switch (toolName) {
    case "find_time_slots": {
      const slots = asRecordArray(data);
      return {
        key: "candidate_slots",
        type: "candidate_slots",
        value: slots,
        summary: `Found ${slots.length} candidate slots.`,
        createdAt: now.toISOString(),
      };
    }
    case "write_draft": {
      const draft = asRecord(data);
      return {
        key: "draft_result",
        type: "draft_result",
        value: draft,
        summary: `Draft created: ${stringField(draft, "subject")}`,
        createdAt: now.toISOString(),
      };
    }
    case "create_event":
    case "update_event": {
      const event = asRecord(data);
      return {
        key: "event_result",
        type: "event_result",
        value: event,
        summary: `${toolName === "create_event" ? "Created" : "Updated"} event ${stringField(event, "summary") || stringField(event, "id")}`,
        createdAt: now.toISOString(),
      };
    }
    default:
      return {
        key: `tool:${toolName}`,
        type: "tool_result",
        value: data,
        summary,
        createdAt: now.toISOString(),
      };
  }
}

function resolveSlotSelection(active: TaskSubgoal, userInput: string, now: Date): TaskArtifact | null {
  const candidateArtifact = active.artifacts.find((artifact) => artifact.key === "candidate_slots");
  const slots = asRecordArray(candidateArtifact?.value);
  if (slots.length === 0) {
    return null;
  }

  const trimmed = userInput.trim();
  const index = Number(trimmed);
  if (Number.isInteger(index) && index >= 1 && index <= slots.length) {
    const slot = slots[index - 1]!;
    return {
      key: "selected_slot",
      type: "selected_slot",
      value: slot,
      summary: `Selected slot ${stringField(slot, "start")} -> ${stringField(slot, "end")}`,
      createdAt: now.toISOString(),
    };
  }

  const matched = slots.find((slot) => {
    const start = stringField(slot, "start");
    const end = stringField(slot, "end");
    return trimmed.includes(start) || trimmed.includes(end);
  });

  if (!matched) {
    return null;
  }

  return {
    key: "selected_slot",
    type: "selected_slot",
    value: matched,
    summary: `Selected slot ${stringField(matched, "start")} -> ${stringField(matched, "end")}`,
    createdAt: now.toISOString(),
  };
}

function buildSlotPrompt(description: string, slots: Record<string, unknown>[]) {
  const lines = slots.slice(0, 5).map((slot, index) => {
    return `${index + 1}. ${stringField(slot, "start")} -> ${stringField(slot, "end")}`;
  });

  return [
    `I found multiple possible time slots for ${description}. Which one should I use?`,
    ...lines,
  ].join("\n");
}

function completesSubgoal(toolName: string, subgoal: TaskSubgoal) {
  if (subgoal.kind === "email") {
    return toolName === "write_draft";
  }

  if (subgoal.kind === "calendar") {
    return ["create_event", "update_event", "delete_event"].includes(toolName);
  }

  return subgoal.completionMode === "response";
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

function requiresCalendarMutation(normalizedUserInput: string) {
  return /\b(schedule|resched|reschedule|move|book|create|delete|cancel)\b/i.test(normalizedUserInput);
}

function cloneTaskState(taskState: TaskState): TaskState {
  return {
    ...taskState,
    subgoals: taskState.subgoals.map((subgoal) => ({
      ...subgoal,
      relatedTools: [...subgoal.relatedTools],
      artifacts: subgoal.artifacts.map((artifact) => ({ ...artifact })),
    })),
    awaitingUserResponse: taskState.awaitingUserResponse
      ? { ...taskState.awaitingUserResponse }
      : undefined,
  };
}

function getSubgoalById(taskState: TaskState, subgoalId: string) {
  return taskState.subgoals.find((subgoal) => subgoal.id === subgoalId);
}

function upsertArtifact(subgoal: TaskSubgoal, artifact: TaskArtifact) {
  const index = subgoal.artifacts.findIndex((existing) => existing.key === artifact.key);
  if (index >= 0) {
    subgoal.artifacts[index] = artifact;
    return;
  }
  subgoal.artifacts.push(artifact);
}

function hasArtifact(subgoal: TaskSubgoal, key: string) {
  return subgoal.artifacts.some((artifact) => artifact.key === key);
}

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asRecordArray(value: unknown) {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function tokenize(value: string) {
  const stopWords = new Set(["a", "an", "and", "for", "i", "it", "my", "of", "please", "the", "to", "with", "you"]);
  return new Set(
    normalizeText(value)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2 && !stopWords.has(token)),
  );
}

function looksLikeFollowUpReply(value: string) {
  return /^(yes|y|ok|okay|sure|sounds good|that works|go ahead|do it|use the first one|use the second one|use the third one|perfect lets use this)\b/i.test(
    value,
  );
}

function looksLikeContinuation(value: string) {
  return looksLikeFollowUpReply(value) || /^(also|and|plus|one more thing)\b/i.test(value);
}

function pushUnique(values: string[], value: string) {
  if (value && !values.includes(value)) {
    values.push(value);
  }
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
}
