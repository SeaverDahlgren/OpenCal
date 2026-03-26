export type SessionDto = {
  session: {
    sessionId: string;
    status: string;
    user: {
      name: string;
      email: string;
    };
    timezone: string;
    hasBlockedTask: boolean;
    activeTaskSummary: string;
  };
};

export type TodayDto = {
  date: string;
  timezone: string;
  greeting: string;
  schedule: Array<{
    eventId: string;
    title: string;
    timeLabel: string;
    attendeePreview: string[];
  }>;
  insight: {
    title: string;
    body: string;
    actionLabel: string;
    action?: {
      type: string;
      prompt: string;
    };
  } | null;
  stale: boolean;
};

export type CalendarMonthDto = {
  monthLabel: string;
  days: Array<{
    date: string;
    inMonth: boolean;
    isToday: boolean;
    eventCount: number;
    highlights: Array<{ tone: string }>;
  }>;
};

export type CalendarDayDto = {
  dateLabel: string;
  items: Array<{
    eventId: string;
    title: string;
    timeLabel: string;
    attendees: Array<{ name: string; email: string }>;
  }>;
};

export type SettingsDto = {
  profile: {
    name: string;
    email: string;
  };
  preferences: {
    timezone: string;
    workStart: string;
    workEnd: string;
    meetingPreference: string;
    assistantNotes: string;
  };
  advanced: {
    provider: string;
    model: string;
    toolResultVerbosity: "compact" | "verbose";
    sessionId: string;
    sessionStatus: string;
  };
};

export type AgentTurnDto = {
  assistant: {
    message: string;
  };
  clarification: {
    type: "choice" | "freeform";
    prompt: string;
    options: Array<{
      id: string;
      label: string;
      value: string;
    }>;
  } | null;
  confirmation: {
    type: "protected_action";
    prompt: string;
    actionLabel: string;
    cancelLabel: string;
    payloadPreview: {
      kind: string;
      summary?: string;
      subject?: string;
    };
  } | null;
  session: {
    hasBlockedTask: boolean;
  };
};

export type ApiErrorDto = {
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
};
