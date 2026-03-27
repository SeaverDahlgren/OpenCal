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
    return buildGoogleAuthorizationUrl(this.config, {
      state,
      redirectUri: this.config.googleApiRedirectUri,
    });
  }

  async completeAuthorization(code: string) {
    const auth = await exchangeGoogleAuthorizationCode(
      this.config,
      code,
      this.config.googleApiRedirectUri,
    );
    const oauth2 = google.oauth2({ version: "v2", auth });
    const profile = await oauth2.userinfo.get();
    const user = {
      name: profile.data.name ?? "OpenCal Beta User",
      email: profile.data.email ?? "unknown@example.com",
    };
    return await this.sessions.createOrReplaceSession(user);
  }

  async reuseAuthorizedSession() {
    try {
      const auth = await loadStoredGoogleAuthorization(this.config);
      if (!auth) {
        return null;
      }

      await auth.getAccessToken();

      const oauth2 = google.oauth2({ version: "v2", auth });
      const profile = await oauth2.userinfo.get();
      const user = {
        name: profile.data.name ?? "OpenCal Beta User",
        email: profile.data.email ?? "unknown@example.com",
      };
      const current = await this.sessions.getByUserEmail(user.email);
      if (current) {
        return current;
      }
      return await this.sessions.createOrReplaceSession(user);
    } catch {
      return null;
    }
  }

  async loadAuthorizedGoogleClients() {
    try {
      const auth = await loadStoredGoogleAuthorization(this.config);
      if (!auth) {
        return null;
      }
      await auth.getAccessToken();
      return createGoogleClients(auth);
    } catch {
      return null;
    }
  }
}
