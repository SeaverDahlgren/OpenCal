import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../../../../src/config/env.js";
import type { SessionStateFile, StoredSessionState } from "../../../../src/app/session-types.js";
import { readSecureJsonFile, writeSecureJsonFile } from "../storage/secure-json.js";

const SESSION_FILE = "mobile-sessions.json";

export class SessionStore {
  constructor(private readonly config: AppConfig) {}

  async loadByToken(token: string) {
    const state = await this.readState();
    return Object.values(state.sessions).find((session) => session.token === token) ?? null;
  }

  async getCurrentSession() {
    const state = await this.readState();
    const sessions = Object.values(state.sessions).sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
    return sessions[0] ?? null;
  }

  async getByUserEmail(email: string) {
    const state = await this.readState();
    return (
      Object.values(state.sessions)
        .filter((session) => session.user.email === email)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
    );
  }

  async loadBySessionId(sessionId: string) {
    const state = await this.readState();
    return state.sessions[sessionId] ?? null;
  }

  async listSessions() {
    const state = await this.readState();
    return Object.values(state.sessions).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async createOrReplaceSession(user: { name: string; email: string }) {
    const state = await this.readState();
    const now = new Date().toISOString();
    const current =
      Object.values(state.sessions)
        .filter((session) => session.user.email === user.email)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
    const sessionId = current?.sessionId ?? `sess_${crypto.randomUUID()}`;
    const session: StoredSessionState = {
      sessionId,
      token: crypto.randomBytes(24).toString("hex"),
      expiresAt: buildExpiry(now, this.config.sessionTtlDays),
      user,
      provider: this.config.llmProvider,
      model: resolveModelName(this.config, this.config.llmProvider),
      toolResultVerbosity: this.config.toolResultVerbosity,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
      messages: [],
      taskState: null,
      pendingConfirmation: null,
    };
    state.sessions[sessionId] = session;
    await this.writeState(state);
    return session;
  }

  async save(session: StoredSessionState) {
    const state = await this.readState();
    state.sessions[session.sessionId] = session;
    await this.writeState(state);
  }

  async resetSession(sessionId: string) {
    const state = await this.readState();
    const current = state.sessions[sessionId];
    if (!current) {
      return null;
    }

    const reset: StoredSessionState = {
      ...current,
      updatedAt: new Date().toISOString(),
      provider: current.provider,
      model: current.model,
      toolResultVerbosity: current.toolResultVerbosity,
      messages: [],
      taskState: null,
      pendingConfirmation: null,
    };
    state.sessions[sessionId] = reset;
    await this.writeState(state);
    return reset;
  }

  async deleteSession(sessionId: string) {
    const state = await this.readState();
    const current = state.sessions[sessionId];
    if (!current) {
      return null;
    }

    delete state.sessions[sessionId];
    if (state.currentSessionId === sessionId) {
      state.currentSessionId = undefined;
    }
    await this.writeState(state);
    return current;
  }

  private async readState(): Promise<SessionStateFile> {
    await fs.mkdir(this.config.privateDir, { recursive: true });
    const filePath = this.filePath();
    const parsed = await readSecureJsonFile<SessionStateFile>(filePath, this.config.stateEncryptionKey);
    if (!parsed) {
      return {
        currentSessionId: undefined,
        sessions: {},
      };
    }

    const nextState = pruneExpiredSessions(parsed);
    if (nextState !== parsed) {
      await this.writeState(nextState);
    }
    return nextState;
  }

  private async writeState(state: SessionStateFile) {
    await writeSecureJsonFile(this.filePath(), state, this.config.stateEncryptionKey);
  }

  private filePath() {
    return path.join(this.config.privateDir, SESSION_FILE);
  }
}

function resolveModelName(config: AppConfig, provider: string) {
  switch (provider) {
    case "groq":
      return config.groqModel;
    case "openai":
      return config.openAiModel;
    default:
      return config.geminiModel;
  }
}

function buildExpiry(nowIso: string, ttlDays: number) {
  const expires = new Date(nowIso);
  expires.setUTCDate(expires.getUTCDate() + ttlDays);
  return expires.toISOString();
}

function pruneExpiredSessions(state: SessionStateFile) {
  const now = new Date().toISOString();
  let changed = false;
  const sessions = Object.fromEntries(
    Object.entries(state.sessions).filter(([, session]) => {
      const active = session.expiresAt > now;
      if (!active) {
        changed = true;
      }
      return active;
    }),
  );

  if (!changed) {
    return state;
  }

  return {
    ...state,
    currentSessionId:
      state.currentSessionId && sessions[state.currentSessionId] ? state.currentSessionId : undefined,
    sessions,
  };
}
