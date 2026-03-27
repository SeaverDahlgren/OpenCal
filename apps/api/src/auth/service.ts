import { google } from "googleapis";
import type { AppConfig } from "../../../../src/config/env.js";
import {
  buildGoogleAuthorizationUrl,
  createGoogleOAuthClient,
  createGoogleClients,
  exchangeGoogleAuthorizationCode,
  loadStoredGoogleAuthorization,
} from "../../../../src/integrations/google/auth.js";
import { GoogleTokenStore } from "./token-store.js";
import type { GoogleTokenRepository, SessionRepository } from "../storage/types.js";

export class ApiAuthService {
  constructor(
    private readonly config: AppConfig,
    private readonly sessions: SessionRepository,
    private readonly tokens: GoogleTokenRepository,
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
      { persist: false },
    );
    const oauth2 = google.oauth2({ version: "v2", auth });
    const profile = await oauth2.userinfo.get();
    const user = {
      name: profile.data.name ?? "OpenCal Beta User",
      email: profile.data.email ?? "unknown@example.com",
    };
    await this.tokens.save(user.email, auth.credentials);
    return await this.sessions.createOrReplaceSession(user);
  }

  async reuseAuthorizedSession() {
    if (this.config.appEnv !== "development") {
      return null;
    }

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
      await this.tokens.save(user.email, auth.credentials);
      const current = await this.sessions.getByUserEmail(user.email);
      if (current) {
        return current;
      }
      return await this.sessions.createOrReplaceSession(user);
    } catch {
      return null;
    }
  }

  async loadAuthorizedGoogleClients(userEmail: string) {
    try {
      const stored = await this.tokens.load(userEmail);
      if (stored) {
        const client = createGoogleOAuthClient(this.config);
        client.setCredentials(stored);
        await client.getAccessToken();
        return createGoogleClients(client as never);
      }

      if (this.config.appEnv !== "development") {
        return null;
      }

      const auth = await loadStoredGoogleAuthorization(this.config);
      if (!auth) {
        return null;
      }
      await auth.getAccessToken();
      await this.tokens.save(userEmail, auth.credentials);
      return createGoogleClients(auth);
    } catch {
      return null;
    }
  }
}
