import type { UserProfile } from "../users/profile.js";

export function mapSettingsView(args: {
  profile: UserProfile;
  provider: string;
  model: string;
  verbosity: "compact" | "verbose";
  sessionId?: string;
  user: { name: string; email: string };
}) {
  return {
    profile: {
      email: args.profile.email || args.user.email,
      name: args.profile.name || args.user.name,
    },
    preferences: {
      name: args.profile.name,
      timezone: args.profile.timezone,
      workStart: args.profile.workStart,
      workEnd: args.profile.workEnd,
      meetingPreference: args.profile.meetingPreference,
      assistantNotes: args.profile.assistantNotes,
    },
    advanced: {
      provider: args.provider,
      model: args.model,
      toolResultVerbosity: args.verbosity,
      sessionId: args.sessionId ?? "",
      sessionStatus: args.sessionId ? "active" : "disconnected",
    },
  };
}
