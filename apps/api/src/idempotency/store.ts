import type { AppConfig } from "../../../../src/config/env.js";
import { readSecureJsonFile, writeSecureJsonFile } from "../storage/secure-json.js";

const STORE_FILE = "idempotency-keys.json";

export type IdempotencyRecord = {
  key: string;
  sessionId: string;
  route: string;
  requestHash: string;
  response: unknown;
  status: number;
  createdAt: string;
  expiresAt: string;
};

type IdempotencyState = {
  records: Record<string, IdempotencyRecord>;
};

export class IdempotencyStore {
  constructor(private readonly config: AppConfig) {}

  async load(sessionId: string, key: string) {
    const state = await this.readState();
    return state.records[recordKey(sessionId, key)] ?? null;
  }

  async save(record: IdempotencyRecord) {
    const state = await this.readState();
    state.records[recordKey(record.sessionId, record.key)] = record;
    await writeSecureJsonFile(
      this.filePath(),
      pruneRecords(state, this.config.idempotencyMaxRecords),
      this.config.stateEncryptionKey,
    );
  }

  private async readState(): Promise<IdempotencyState> {
    const current = (await readSecureJsonFile<IdempotencyState>(this.filePath(), this.config.stateEncryptionKey)) ?? {
      records: {},
    };
    const next = pruneRecords(current, this.config.idempotencyMaxRecords);
    if (next !== current) {
      await writeSecureJsonFile(this.filePath(), next, this.config.stateEncryptionKey);
    }
    return next;
  }

  private filePath() {
    return `${this.config.privateDir}/${STORE_FILE}`;
  }
}

export function buildIdempotencyExpiry(ttlHours: number, nowIso = new Date().toISOString()) {
  const expires = new Date(nowIso);
  expires.setUTCHours(expires.getUTCHours() + ttlHours);
  return expires.toISOString();
}

function recordKey(sessionId: string, key: string) {
  return `${sessionId}:${key}`;
}

function pruneRecords(state: IdempotencyState, maxRecords: number) {
  const now = new Date().toISOString();
  let changed = false;
  const activeRecords = Object.entries(state.records).filter(([, record]) => {
    const active = record.expiresAt > now;
    if (!active) {
      changed = true;
    }
    return active;
  });
  const limitedRecords = activeRecords
    .sort(([, left], [, right]) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, maxRecords);
  if (limitedRecords.length !== activeRecords.length) {
    changed = true;
  }
  const records = Object.fromEntries(limitedRecords);
  return changed ? { records } : state;
}
