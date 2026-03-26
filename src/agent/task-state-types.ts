export type TaskMode = "planning" | "executing" | "blocked";
export type TaskSubgoalStatus = "pending" | "active" | "blocked" | "completed" | "cancelled";
export type TaskSubgoalKind = "calendar" | "email" | "clarification" | "general";
export type AwaitingUserResponseKind = "clarification" | "followup";

export type AwaitingUserResponseOption = {
  value: string;
  labels: string[];
  summary: string;
};

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
  options?: AwaitingUserResponseOption[];
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
