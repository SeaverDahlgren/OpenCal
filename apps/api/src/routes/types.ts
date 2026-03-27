import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";
import type { AppConfig } from "../../../../src/config/env.js";
import type { GoogleClients } from "../../../../src/integrations/google/auth.js";
import type { WorkspaceFiles } from "../../../../src/memory/workspace.js";
import type { StoredSessionState } from "../../../../src/app/session-types.js";
import type { ApiAuthService } from "../auth/service.js";
import type { SessionStore } from "../sessions/store.js";
import type { GoogleCalendarService } from "../../../../src/integrations/google/calendar.js";
import type { UserProfileStore } from "../users/store.js";
import type { UserProfile } from "../users/profile.js";

export type PublicRouteContext = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  config: AppConfig;
  auth: ApiAuthService;
  sessions: SessionStore;
  profiles: UserProfileStore;
};

export type SessionRouteContext = PublicRouteContext & {
  session: StoredSessionState;
  profile: UserProfile;
};

export type AuthedRouteContext = SessionRouteContext & {
  googleClients: GoogleClients;
  workspace: WorkspaceFiles;
  calendarService: GoogleCalendarService;
};
