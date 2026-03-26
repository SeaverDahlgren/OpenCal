import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../../../../src/config/env.js";
import type { SessionStateFile, StoredSessionState } from "../../../../src/app/session-types.js";

const SESSION_FILE = "mobile-sessions.json";

export class SessionStore {
  constructor(private readonly config: AppConfig) {}

  async loadByToken(token: string) {
    const state = await this.readState();
    return Object.values(state.sessions).find((session) => session.token === token) ?? null;
  }

  async getCurrentSession() {
    const state = await this.readState();
    return state.currentSessionId ? state.sessions[state.currentSessionId] ?? null : null;
  }

  async createOrReplaceSession(user: { name: string; email: string }) {
    const state = await this.readState();
    const now = new Date().toISOString();
    const sessionId = `sess_${crypto.randomUUID()}`;
    const session: StoredSessionState = {
      sessionId,
      token: crypto.randomBytes(24).toString("hex"),
      user,
      provider: this.config.llmProvider,
      model: resolveModelName(this.config, this.config.llmProvider),
      toolResultVerbosity: this.config.toolResultVerbosity,
      createdAt: now,
      updatedAt: now,
      messages: [],
      taskState: null,
      pendingConfirmation: null,
    };
    state.currentSessionId = sessionId;
    state.sessions = {
      [sessionId]: session,
    };
    await this.writeState(state);
    return session;
  }

  async save(session: StoredSessionState) {
    const state = await this.readState();
    state.currentSessionId = session.sessionId;
    state.sessions[session.sessionId] = session;
    await this.writeState(state);
  }

  async resetCurrentSession() {
    const current = await this.getCurrentSession();
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
    await this.save(reset);
    return reset;
  }

  private async readState(): Promise<SessionStateFile> {
    await fs.mkdir(this.config.privateDir, { recursive: true });
    const filePath = this.filePath();
    try {
      return JSON.parse(await fs.readFile(filePath, "utf8")) as SessionStateFile;
    } catch {
      return {
        currentSessionId: undefined,
        sessions: {},
      };
    }
  }

  private async writeState(state: SessionStateFile) {
    await fs.writeFile(this.filePath(), JSON.stringify(state, null, 2), "utf8");
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
