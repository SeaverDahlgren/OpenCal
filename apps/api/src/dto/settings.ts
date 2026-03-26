type PreferenceSnapshot = {
  timezone: string;
  workStart: string;
  workEnd: string;
  meetingPreference: string;
  assistantNotes: string;
};

export function mapSettingsView(args: {
  userMarkdown: string;
  provider: string;
  model: string;
  verbosity: "compact" | "verbose";
  sessionId?: string;
  user: { name: string; email: string };
}) {
  const prefs = parseUserPreferences(args.userMarkdown);
  return {
    profile: args.user,
    preferences: prefs,
    advanced: {
      provider: args.provider,
      model: args.model,
      toolResultVerbosity: args.verbosity,
      sessionId: args.sessionId ?? "",
      sessionStatus: args.sessionId ? "active" : "disconnected",
    },
  };
}

export function updateUserMarkdown(userMarkdown: string, input: Partial<PreferenceSnapshot>) {
  const next = { ...parseUserPreferences(userMarkdown), ...input };
  const lines = [
    `timezone: ${next.timezone}`,
    `workStart: ${next.workStart}`,
    `workEnd: ${next.workEnd}`,
    `meetingPreference: ${next.meetingPreference}`,
    `assistantNotes: ${next.assistantNotes}`,
  ];
  return `${lines.join("\n")}\n`;
}

function parseUserPreferences(userMarkdown: string): PreferenceSnapshot {
  return {
    timezone: matchValue(userMarkdown, "timezone") ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    workStart: matchValue(userMarkdown, "workStart") ?? "09:00",
    workEnd: matchValue(userMarkdown, "workEnd") ?? "17:00",
    meetingPreference: matchValue(userMarkdown, "meetingPreference") ?? "",
    assistantNotes: matchValue(userMarkdown, "assistantNotes") ?? "",
  };
}

function matchValue(markdown: string, key: string) {
  const match = markdown.match(new RegExp(`^${key}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim();
}
