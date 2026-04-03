export type UserProfile = {
  email: string;
  name: string;
  timezone: string;
  workStart: string;
  workEnd: string;
  meetingPreference: string;
  interests: string;
  additionalContext: string;
  assistantNotes: string;
  personalizationCompletedAt?: string;
  updatedAt: string;
};

export type UserProfileInput = Partial<
  Pick<
    UserProfile,
    | "name"
    | "timezone"
    | "workStart"
    | "workEnd"
    | "meetingPreference"
    | "interests"
    | "additionalContext"
    | "assistantNotes"
    | "personalizationCompletedAt"
  >
>;

export function createUserProfile(
  user: { name: string; email: string },
  now = new Date().toISOString(),
): UserProfile {
  return {
    email: user.email,
    name: user.name,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    workStart: "09:00",
    workEnd: "17:00",
    meetingPreference: "",
    interests: "",
    additionalContext: "",
    assistantNotes: "",
    personalizationCompletedAt: undefined,
    updatedAt: now,
  };
}

export function updateUserProfile(profile: UserProfile, input: UserProfileInput, now = new Date().toISOString()): UserProfile {
  const definedUpdates = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as UserProfileInput;

  return {
    ...profile,
    ...definedUpdates,
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
    `interests: ${profile.interests}`,
    `additionalContext: ${profile.additionalContext}`,
    `assistantNotes: ${profile.assistantNotes}`,
  ];
  return `${lines.join("\n")}\n`;
}

export function buildProfilePersonalizationBlock(profile: UserProfile) {
  const entries = [
    profile.name ? `user_name: ${profile.name}` : "",
    profile.workStart || profile.workEnd ? `work_hours: ${profile.workStart}-${profile.workEnd}` : "",
    profile.meetingPreference ? `meeting_preference: ${profile.meetingPreference}` : "",
    profile.interests ? `current_interests: ${profile.interests}` : "",
    profile.additionalContext ? `additional_context: ${profile.additionalContext}` : "",
    profile.assistantNotes ? `assistant_notes: ${profile.assistantNotes}` : "",
  ].filter(Boolean);

  if (entries.length === 0) {
    return "";
  }

  return entries.map((entry) => `- ${entry}`).join("\n");
}

export function needsUserPersonalization(profile: UserProfile) {
  return !profile.personalizationCompletedAt;
}
