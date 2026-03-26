import type { ToolResult } from "../tools/types.js";
import { buildArtifact, completesSubgoal } from "./task-state-artifacts.js";
import { inferSubgoals, summarizeTask } from "./task-state-inference.js";
import {
  buildSlotOptions,
  buildSlotPrompt,
  looksLikeContinuation,
  looksLikeFollowUpReply,
  resolveAwaitingOption,
  resolveSlotSelection,
} from "./task-state-replies.js";
import type {
  AwaitingUserResponseKind,
  AwaitingUserResponseOption,
  TaskState,
  TaskSubgoal,
} from "./task-state-types.js";
export type {
  AwaitingUserResponse,
  AwaitingUserResponseKind,
  AwaitingUserResponseOption,
  TaskArtifact,
  TaskMode,
  TaskState,
  TaskSubgoal,
  TaskSubgoalKind,
  TaskSubgoalStatus,
} from "./task-state-types.js";
import {
  asRecordArray,
  cloneTaskState,
  getSubgoalById,
  hasArtifact,
  normalizeText,
  pushUnique,
  stringField,
  tokenize,
  truncate,
  upsertArtifact,
} from "./task-state-utils.js";

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

export function tryResolveBlockedReply(
  taskState: TaskState,
  userInput: string,
  now = new Date(),
): { matched: boolean; matchedValue?: string; taskState: TaskState } {
  if (!taskState.awaitingUserResponse) {
    return { matched: false, taskState };
  }

  const options = taskState.awaitingUserResponse.options ?? [];
  if (options.length === 0) {
    return {
      matched: true,
      matchedValue: userInput.trim(),
      taskState: bindUserReplyToTaskState(taskState, userInput, now),
    };
  }

  const matched = resolveAwaitingOption(options, userInput);
  if (!matched) {
    return { matched: false, taskState };
  }

  return {
    matched: true,
    matchedValue: matched.value,
    taskState: bindUserReplyToTaskState(taskState, matched.value, now),
  };
}

export function registerAwaitingUserResponse(
  taskState: TaskState,
  prompt: string,
  responseKind: AwaitingUserResponseKind,
  subgoalId: string,
  options: AwaitingUserResponseOption[] = [],
  now = new Date(),
): TaskState {
  const next = cloneTaskState(taskState);
  const subgoal = getSubgoalById(next, subgoalId);
  next.lastResolvedAt = now.toISOString();
  next.awaitingUserResponse = {
    prompt,
    subgoalId,
    responseKind,
    options,
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

export function beginExecution(taskState: TaskState, toolNames: string[], now = new Date()): TaskState {
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
          options: buildSlotOptions(slots),
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
        options: [],
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
