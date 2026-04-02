import { appendDebugLog } from "../../../../src/memory/logs.js";
import { executeAgentTurn } from "../agent/execute-turn.js";
import type { ApiAuthService } from "../auth/service.js";
import { hostedDebugLogPath } from "../runtime/filesystem.js";
import type { MemoryRepository, JobRepository, SessionRepository, UserProfileRepository } from "../storage/types.js";
import type { JobRecord } from "./types.js";
import { buildNextRunAt } from "./store.js";

type JobProcessorDeps = {
  config: import("../../../../src/config/env.js").AppConfig;
  auth: ApiAuthService;
  sessions: SessionRepository;
  profiles: UserProfileRepository;
  memories: MemoryRepository;
  jobs: JobRepository;
};

export class JobProcessor {
  constructor(private readonly deps: JobProcessorDeps) {}

  async processNext() {
    const job = await this.deps.jobs.reserveNext();
    if (!job) {
      return null;
    }

    try {
      switch (job.kind) {
        case "agent_turn_retry":
          await this.processAgentTurnRetry(job);
          break;
      }
      return await this.deps.jobs.load(job.jobId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const nextRunAt = buildNextRunAt(this.deps.config.jobRetryDelayMs);
      await this.deps.jobs.fail(job.jobId, message, nextRunAt);
      await appendDebugLog(debugLogPath(this.deps.config), "job.failed", {
        jobId: job.jobId,
        kind: job.kind,
        error: message,
      });
      return await this.deps.jobs.load(job.jobId);
    }
  }

  private async processAgentTurnRetry(job: JobRecord | null) {
    if (!job) {
      return;
    }
    const session = await this.deps.sessions.loadBySessionId(job.payload.sessionId);
    if (!session) {
      throw new Error(`Missing session for job ${job.jobId}`);
    }
    const googleClients = await this.deps.auth.loadAuthorizedGoogleClients(session.user.email);
    if (!googleClients) {
      throw new Error(`Missing Google auth for session ${session.sessionId}`);
    }
    const profile = await this.deps.profiles.loadOrCreate(session.user);
    const memories = await this.deps.memories.listByEmail(session.user.email);
    const result = await executeAgentTurn({
      config: this.deps.config,
      session,
      profile,
      memories,
      googleClients,
      action: job.payload.action,
    });
    await this.deps.sessions.save(result.session);
    await this.deps.jobs.complete(job.jobId, result.response);
    await appendDebugLog(debugLogPath(this.deps.config), "job.completed", {
      jobId: job.jobId,
      kind: job.kind,
      sessionId: session.sessionId,
    });
  }
}

function debugLogPath(config: import("../../../../src/config/env.js").AppConfig) {
  return hostedDebugLogPath(config);
}
