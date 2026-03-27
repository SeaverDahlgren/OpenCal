import fs from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../../../../src/config/env.js";
import { readSecureJsonFile, writeSecureJsonFile } from "../storage/secure-json.js";
import { createUserProfile, type UserProfile } from "./profile.js";

const PROFILE_FILE = "user-profiles.json";

type UserProfileState = {
  profiles: Record<string, UserProfile>;
};

export class UserProfileStore {
  constructor(private readonly config: AppConfig) {}

  async load(email: string) {
    const state = await this.readState();
    return state.profiles[profileKey(email)] ?? null;
  }

  async loadOrCreate(user: { name: string; email: string }, legacyMarkdown = "") {
    const state = await this.readState();
    const key = profileKey(user.email);
    const existing = state.profiles[key];
    if (existing) {
      return existing;
    }

    const profile = createUserProfile(user, legacyMarkdown);
    state.profiles[key] = profile;
    await this.writeState(state);
    return profile;
  }

  async save(profile: UserProfile) {
    const state = await this.readState();
    state.profiles[profileKey(profile.email)] = profile;
    await this.writeState(state);
  }

  private async readState(): Promise<UserProfileState> {
    await fs.mkdir(this.config.privateDir, { recursive: true });
    return (
      (await readSecureJsonFile<UserProfileState>(this.filePath(), this.config.stateEncryptionKey)) ?? { profiles: {} }
    );
  }

  private async writeState(state: UserProfileState) {
    await writeSecureJsonFile(this.filePath(), state, this.config.stateEncryptionKey);
  }

  private filePath() {
    return path.join(this.config.privateDir, PROFILE_FILE);
  }
}

function profileKey(email: string) {
  return email.trim().toLowerCase();
}
