import crypto from "node:crypto";
import type { AppConfig } from "../../../../src/config/env.js";
import { readSecureJsonFile, writeSecureJsonFile } from "../storage/secure-json.js";
import type { AuditEvent } from "./types.js";

const STORE_FILE = "audit-events.json";

type AuditState = {
  events: AuditEvent[];
};

export class AuditStore {
  constructor(private readonly config: AppConfig) {}

  async append(input: Omit<AuditEvent, "eventId" | "createdAt">) {
    const state = await this.readState();
    const event: AuditEvent = {
      eventId: `audit_${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      ...input,
    };
    state.events.unshift(event);
    state.events = state.events.slice(0, 1000);
    await this.writeState(state);
    return event;
  }

  async list() {
    const state = await this.readState();
    return state.events;
  }

  private async readState(): Promise<AuditState> {
    return (
      (await readSecureJsonFile<AuditState>(this.filePath(), this.config.stateEncryptionKey)) ?? {
        events: [],
      }
    );
  }

  private async writeState(state: AuditState) {
    await writeSecureJsonFile(this.filePath(), state, this.config.stateEncryptionKey);
  }

  private filePath() {
    return `${this.config.privateDir}/${STORE_FILE}`;
  }
}
