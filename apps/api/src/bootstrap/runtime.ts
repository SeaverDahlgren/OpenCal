import type { AppConfig } from "../../../../src/config/env.js";
import { AuditStore } from "../audit/store.js";
import { GoogleTokenStore } from "../auth/token-store.js";
import { BetaUserStore } from "../beta-users/store.js";
import { IdempotencyStore } from "../idempotency/store.js";
import { JobStore } from "../jobs/store.js";
import { SessionStore } from "../sessions/store.js";
import type {
  GoogleTokenRepository,
  BetaUserRepository,
  AuditRepository,
  IdempotencyRepository,
  JobRepository,
  SessionRepository,
  UserProfileRepository,
} from "../storage/types.js";
import { UserProfileStore } from "../users/store.js";

export type RuntimeStores = {
  sessions: SessionRepository;
  profiles: UserProfileRepository;
  tokens: GoogleTokenRepository;
  betaUsers: BetaUserRepository;
  audit: AuditRepository;
  idempotency: IdempotencyRepository;
  jobs: JobRepository;
};

export function createRuntimeStores(config: AppConfig): RuntimeStores {
  if (config.storageBackend !== "file") {
    throw new Error(`Unsupported STORAGE_BACKEND: ${config.storageBackend}`);
  }

  if (config.jobBackend !== "file") {
    throw new Error(`Unsupported JOB_BACKEND: ${config.jobBackend}`);
  }

  return {
    sessions: new SessionStore(config),
    profiles: new UserProfileStore(config),
    tokens: new GoogleTokenStore(config),
    betaUsers: new BetaUserStore(config),
    audit: new AuditStore(config),
    idempotency: new IdempotencyStore(config),
    jobs: new JobStore(config),
  };
}
