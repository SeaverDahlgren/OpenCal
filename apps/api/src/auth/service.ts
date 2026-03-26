import { google } from "googleapis";
import type { AppConfig } from "../../../../src/config/env.js";
import {
  buildGoogleAuthorizationUrl,
  createGoogleClients,
  exchangeGoogleAuthorizationCode,
  loadStoredGoogleAuthorization,
} from "../../../../src/integrations/google/auth.js";
import { SessionStore } from "../sessions/store.js";

export class ApiAuthService {
  constructor(
    private readonly config: AppConfig,
    private readonly sessions: SessionStore,
  ) {}

  buildAuthUrl(state?: string) {
    return buildGoogleAuthorizationUrl(this.config, { state });
  }

  async completeAuthorization(code: string) {
    const auth = await exchangeGoogleAuthorizationCode(this.config, code);
    const oauth2 = google.oauth2({ version: "v2", auth });
    const profile = await oauth2.userinfo.get();
    const user = {
      name: profile.data.name ?? "OpenCal Beta User",
      email: profile.data.email ?? "unknown@example.com",
    };
    return await this.sessions.createOrReplaceSession(user);
  }

  async loadAuthorizedGoogleClients() {
    const auth = await loadStoredGoogleAuthorization(this.config);
    if (!auth) {
      return null;
    }
    return createGoogleClients(auth);
  }
}
