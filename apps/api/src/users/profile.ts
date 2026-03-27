export type UserProfile = {
  email: string;
  name: string;
  timezone: string;
  workStart: string;
  workEnd: string;
  meetingPreference: string;
  assistantNotes: string;
  updatedAt: string;
};

export type UserProfileInput = Partial<
  Pick<UserProfile, "name" | "timezone" | "workStart" | "workEnd" | "meetingPreference" | "assistantNotes">
>;

export function createUserProfile(
  user: { name: string; email: string },
  legacyMarkdown = "",
  now = new Date().toISOString(),
): UserProfile {
  return {
    email: user.email,
    name: matchValue(legacyMarkdown, "name") ?? user.name,
    timezone: matchValue(legacyMarkdown, "timezone") ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    workStart: matchValue(legacyMarkdown, "workStart") ?? "09:00",
    workEnd: matchValue(legacyMarkdown, "workEnd") ?? "17:00",
    meetingPreference: matchValue(legacyMarkdown, "meetingPreference") ?? "",
    assistantNotes: matchValue(legacyMarkdown, "assistantNotes") ?? "",
    updatedAt: now,
  };
}

export function updateUserProfile(profile: UserProfile, input: UserProfileInput, now = new Date().toISOString()): UserProfile {
  return {
    ...profile,
    ...input,
    updatedAt: now,
  };
}

export function renderLegacyUserMarkdown(profile: UserProfile) {
  const lines = [
    `name: ${profile.name}`,
    `timezone: ${profile.timezone}`,
    `workStart: ${profile.workStart}`,
    `workEnd: ${profile.workEnd}`,
    `meetingPreference: ${profile.meetingPreference}`,
    `assistantNotes: ${profile.assistantNotes}`,
  ];
  return `${lines.join("\n")}\n`;
}

function matchValue(markdown: string, key: string) {
  const match = markdown.match(new RegExp(`^${key}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim();
}
