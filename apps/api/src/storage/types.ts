import type { StoredSessionState } from "../../../../src/app/session-types.js";
import type { Credentials } from "google-auth-library";
import type { UserProfile } from "../users/profile.js";
import type { JobRecord } from "../jobs/types.js";

export interface SessionRepository {
  loadByToken(token: string): Promise<StoredSessionState | null>;
  getCurrentSession(): Promise<StoredSessionState | null>;
  getByUserEmail(email: string): Promise<StoredSessionState | null>;
  loadBySessionId(sessionId: string): Promise<StoredSessionState | null>;
  listSessions(): Promise<StoredSessionState[]>;
  createOrReplaceSession(user: { name: string; email: string }): Promise<StoredSessionState>;
  save(session: StoredSessionState): Promise<void>;
  resetSession(sessionId: string): Promise<StoredSessionState | null>;
  deleteSession(sessionId: string): Promise<StoredSessionState | null>;
}

export interface UserProfileRepository {
  load(email: string): Promise<UserProfile | null>;
  loadOrCreate(user: { name: string; email: string }, legacyMarkdown?: string): Promise<UserProfile>;
  save(profile: UserProfile): Promise<void>;
}

export interface GoogleTokenRepository {
  load(email: string): Promise<Credentials | null>;
  save(email: string, credentials: Credentials): Promise<void>;
}

export interface IdempotencyRepository {
  load(sessionId: string, key: string): Promise<import("../idempotency/store.js").IdempotencyRecord | null>;
  save(record: import("../idempotency/store.js").IdempotencyRecord): Promise<void>;
}

export interface JobRepository {
  enqueue(input: Omit<JobRecord, "jobId" | "createdAt" | "updatedAt" | "attempts" | "status">): Promise<JobRecord>;
  list(): Promise<JobRecord[]>;
  load(jobId: string): Promise<JobRecord | null>;
  reserveNext(): Promise<JobRecord | null>;
  complete(jobId: string, result: JobRecord["result"]): Promise<JobRecord | null>;
  fail(jobId: string, error: string, nextRunAt?: string): Promise<JobRecord | null>;
  retry(jobId: string, runAt?: string): Promise<JobRecord | null>;
}
