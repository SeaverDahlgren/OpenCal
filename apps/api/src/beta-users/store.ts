import type { AppConfig } from "../../../../src/config/env.js";
import { readSecureJsonFile, writeSecureJsonFile } from "../storage/secure-json.js";
import type { BetaUserRepository } from "../storage/types.js";

const STORE_FILE = "beta-users.json";

export type BetaUserRecord = {
  email: string;
  name?: string;
  addedAt: string;
  addedBy?: string;
  source: "env" | "admin";
};

type BetaUserState = {
  users: Record<string, BetaUserRecord>;
};

export class BetaUserStore implements BetaUserRepository {
  constructor(private readonly config: AppConfig) {}

  async list() {
    const state = await this.readState();
    return Object.values(state.users).sort((left, right) => left.email.localeCompare(right.email));
  }

  async isAllowed(email: string) {
    const state = await this.readState();
    return Boolean(state.users[userKey(email)]);
  }

  async add(input: { email: string; name?: string; addedBy?: string }) {
    const state = await this.readState();
    const key = userKey(input.email);
    const current = state.users[key];
    const record: BetaUserRecord = {
      email: key,
      name: input.name ?? current?.name,
      addedAt: current?.addedAt ?? new Date().toISOString(),
      addedBy: input.addedBy ?? current?.addedBy,
      source: "admin",
    };
    state.users[key] = record;
    await this.writeState(state);
    return record;
  }

  async remove(email: string) {
    const state = await this.readState();
    const key = userKey(email);
    const current = state.users[key];
    if (!current) {
      return null;
    }
    delete state.users[key];
    await this.writeState(state);
    return current;
  }

  private async readState(): Promise<BetaUserState> {
    const current = (await readSecureJsonFile<BetaUserState>(this.filePath(), this.config.stateEncryptionKey)) ?? {
      users: {},
    };
    const next = seedEnvUsers(current, this.config.betaUserEmails);
    if (next !== current) {
      await this.writeState(next);
    }
    return next;
  }

  private async writeState(state: BetaUserState) {
    await writeSecureJsonFile(this.filePath(), state, this.config.stateEncryptionKey);
  }

  private filePath() {
    return `${this.config.privateDir}/${STORE_FILE}`;
  }
}

function seedEnvUsers(state: BetaUserState, envEmails: string[]) {
  if (envEmails.length === 0) {
    return state;
  }
  let changed = false;
  const users = { ...state.users };
  for (const email of envEmails) {
    const key = userKey(email);
    if (!users[key]) {
      users[key] = {
        email: key,
        addedAt: new Date(0).toISOString(),
        source: "env",
      };
      changed = true;
    }
  }
  return changed ? { users } : state;
}

function userKey(email: string) {
  return email.trim().toLowerCase();
}
