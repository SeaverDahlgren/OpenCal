import type { AgentActionRequest, AssistantTurnPayload } from "../../../../src/app/session-types.js";

export type JobKind = "agent_turn_retry";
export type JobStatus = "pending" | "running" | "completed" | "failed";

export type AgentTurnRetryJobPayload = {
  sessionId: string;
  action: AgentActionRequest;
};

export type JobRecord = {
  jobId: string;
  kind: JobKind;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  runAt: string;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
  payload: AgentTurnRetryJobPayload;
  result?: AssistantTurnPayload;
};
