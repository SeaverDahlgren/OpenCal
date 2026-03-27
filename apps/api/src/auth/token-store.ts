import type { Credentials } from "google-auth-library";
import type { AppConfig } from "../../../../src/config/env.js";
import { readSecureJsonFile, writeSecureJsonFile } from "../storage/secure-json.js";

const TOKEN_FILE = "google-user-tokens.json";

type GoogleTokenState = {
  tokens: Record<string, Credentials>;
};

export class GoogleTokenStore {
  constructor(private readonly config: AppConfig) {}

  async load(email: string) {
    const state = await this.readState();
    return state.tokens[tokenKey(email)] ?? null;
  }

  async save(email: string, credentials: Credentials) {
    const state = await this.readState();
    state.tokens[tokenKey(email)] = credentials;
    await writeSecureJsonFile(this.filePath(), state, this.config.stateEncryptionKey);
  }

  private async readState(): Promise<GoogleTokenState> {
    return (
      (await readSecureJsonFile<GoogleTokenState>(this.filePath(), this.config.stateEncryptionKey)) ?? { tokens: {} }
    );
  }

  private filePath() {
    return `${this.config.privateDir}/${TOKEN_FILE}`;
  }
}

function tokenKey(email: string) {
  return email.trim().toLowerCase();
}
