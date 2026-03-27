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
import type { AuditRepository, BetaUserRepository, GoogleTokenRepository, SessionRepository } from "../storage/types.js";

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

const openBetaUsers: BetaUserRepository = {
  async list() {
    return [];
  },
  async isAllowed() {
    return true;
  },
  async add(input) {
    return {
      email: input.email.trim().toLowerCase(),
      name: input.name,
      addedAt: new Date(0).toISOString(),
      addedBy: input.addedBy,
      source: "admin",
    };
  },
  async remove() {
    return null;
  },
};

export class BetaAccessDeniedError extends Error {
  constructor(
    readonly user: { name: string; email: string },
    readonly mode: "open" | "allowlist",
  ) {
    super(`User ${user.email} is not in the beta access pool.`);
    this.name = "BetaAccessDeniedError";
  }
}

export class ApiAuthService {
  constructor(
    private readonly config: AppConfig,
    private readonly sessions: SessionRepository,
    private readonly tokens: GoogleTokenRepository,
    private readonly betaUsers: BetaUserRepository = openBetaUsers,
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
    await this.assertBetaAccess(user);
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
      await this.assertBetaAccess(user);
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
    } catch (error) {
      if (error instanceof BetaAccessDeniedError) {
        throw error;
      }
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

  private async assertBetaAccess(user: { name: string; email: string }) {
    if (this.config.betaAccessMode !== "allowlist") {
      return;
    }
    if (await this.betaUsers.isAllowed(user.email)) {
      return;
    }
    await this.audit.append({
      type: "auth.beta.denied",
      userEmail: user.email,
      metadata: {
        appEnv: this.config.appEnv,
        mode: this.config.betaAccessMode,
      },
    });
    throw new BetaAccessDeniedError(user, this.config.betaAccessMode);
  }
}
