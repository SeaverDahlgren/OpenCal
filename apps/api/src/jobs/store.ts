import crypto from "node:crypto";
import type { AppConfig } from "../../../../src/config/env.js";
import { readSecureJsonFile, writeSecureJsonFile } from "../storage/secure-json.js";
import type { JobRecord } from "./types.js";

const STORE_FILE = "jobs.json";

type JobState = {
  jobs: Record<string, JobRecord>;
};

export class JobStore {
  constructor(private readonly config: AppConfig) {}

  async enqueue(input: Omit<JobRecord, "jobId" | "createdAt" | "updatedAt" | "attempts" | "status">) {
    const now = new Date().toISOString();
    const job: JobRecord = {
      jobId: `job_${crypto.randomUUID()}`,
      kind: input.kind,
      payload: input.payload,
      maxAttempts: input.maxAttempts,
      runAt: input.runAt,
      attempts: 0,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    const state = await this.readState();
    state.jobs[job.jobId] = job;
    await this.writeState(state);
    return job;
  }

  async list() {
    const state = await this.readState();
    return Object.values(state.jobs).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async load(jobId: string) {
    const state = await this.readState();
    return state.jobs[jobId] ?? null;
  }

  async reserveNext() {
    const state = await this.readState();
    const now = new Date().toISOString();
    const next = Object.values(state.jobs)
      .filter((job) => job.status === "pending" && job.runAt <= now)
      .sort((left, right) => left.runAt.localeCompare(right.runAt))[0];
    if (!next) {
      return null;
    }
    const running: JobRecord = {
      ...next,
      status: "running",
      attempts: next.attempts + 1,
      updatedAt: now,
    };
    state.jobs[running.jobId] = running;
    await this.writeState(state);
    return running;
  }

  async complete(jobId: string, result: JobRecord["result"]) {
    const state = await this.readState();
    const current = state.jobs[jobId];
    if (!current) {
      return null;
    }
    const completed: JobRecord = {
      ...current,
      status: "completed",
      result,
      updatedAt: new Date().toISOString(),
      lastError: undefined,
    };
    state.jobs[jobId] = completed;
    await this.writeState(state);
    return completed;
  }

  async fail(jobId: string, error: string, nextRunAt?: string) {
    const state = await this.readState();
    const current = state.jobs[jobId];
    if (!current) {
      return null;
    }
    const exhausted = current.attempts >= current.maxAttempts;
    const failed: JobRecord = {
      ...current,
      status: exhausted ? "failed" : "pending",
      lastError: error,
      runAt: exhausted ? current.runAt : nextRunAt ?? current.runAt,
      updatedAt: new Date().toISOString(),
    };
    state.jobs[jobId] = failed;
    await this.writeState(state);
    return failed;
  }

  private async readState(): Promise<JobState> {
    return (
      (await readSecureJsonFile<JobState>(this.filePath(), this.config.stateEncryptionKey)) ?? { jobs: {} }
    );
  }

  private async writeState(state: JobState) {
    await writeSecureJsonFile(this.filePath(), state, this.config.stateEncryptionKey);
  }

  private filePath() {
    return `${this.config.privateDir}/${STORE_FILE}`;
  }
}

export function buildNextRunAt(delayMs: number, nowIso = new Date().toISOString()) {
  return new Date(new Date(nowIso).getTime() + delayMs).toISOString();
}
