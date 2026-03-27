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
import type { AuditRepository, GoogleTokenRepository, SessionRepository } from "../storage/types.js";

const noopAudit: AuditRepository = {
  async append() {
    return {
      eventId: "noop",
      type: "auth.google.completed",
      createdAt: new Date(0).toISOString(),
    };
  },
  async list() {
    return [];
  },
};

export class ApiAuthService {
  constructor(
    private readonly config: AppConfig,
    private readonly sessions: SessionRepository,
    private readonly tokens: GoogleTokenRepository,
    private readonly audit: AuditRepository = noopAudit,
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
    const session = await this.sessions.createOrReplaceSession(user);
    await this.audit.append({
      type: "auth.google.completed",
      sessionId: session.sessionId,
      userEmail: user.email,
      metadata: {
        appEnv: this.config.appEnv,
      },
    });
    return session;
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
      const session = await this.sessions.createOrReplaceSession(user);
      await this.audit.append({
        type: "auth.google.reused",
        sessionId: session.sessionId,
        userEmail: user.email,
        metadata: {
          appEnv: this.config.appEnv,
        },
      });
      return session;
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
