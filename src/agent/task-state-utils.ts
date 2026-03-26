import type { TaskArtifact, TaskState, TaskSubgoal } from "./task-state-types.js";

export function cloneTaskState(taskState: TaskState): TaskState {
  return {
    ...taskState,
    subgoals: taskState.subgoals.map((subgoal) => ({
      ...subgoal,
      relatedTools: [...subgoal.relatedTools],
      artifacts: subgoal.artifacts.map((artifact) => ({ ...artifact })),
    })),
    awaitingUserResponse: taskState.awaitingUserResponse
      ? {
          ...taskState.awaitingUserResponse,
          options: taskState.awaitingUserResponse.options?.map((option) => ({ ...option })),
        }
      : undefined,
  };
}

export function getSubgoalById(taskState: TaskState, subgoalId: string) {
  return taskState.subgoals.find((subgoal) => subgoal.id === subgoalId);
}

export function upsertArtifact(subgoal: TaskSubgoal, artifact: TaskArtifact) {
  const index = subgoal.artifacts.findIndex((existing) => existing.key === artifact.key);
  if (index >= 0) {
    subgoal.artifacts[index] = artifact;
    return;
  }
  subgoal.artifacts.push(artifact);
}

export function hasArtifact(subgoal: TaskSubgoal, key: string) {
  return subgoal.artifacts.some((artifact) => artifact.key === key);
}

export function asRecord(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export function asRecordArray(value: unknown) {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

export function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

export function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

export function tokenize(value: string) {
  const stopWords = new Set(["a", "an", "and", "for", "i", "it", "my", "of", "please", "the", "to", "with", "you"]);
  return new Set(
    normalizeText(value)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2 && !stopWords.has(token)),
  );
}

export function pushUnique(values: string[], value: string) {
  if (value && !values.includes(value)) {
    values.push(value);
  }
}

export function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
}

export function normalizeReply(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
