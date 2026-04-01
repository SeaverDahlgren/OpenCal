export type SessionDto = {
  session: {
    sessionId: string;
    status: string;
    expiresAt?: string;
    user: {
      name: string;
      email: string;
    };
    timezone: string;
    hasBlockedTask: boolean;
    activeTaskSummary: string;
    needsPersonalization: boolean;
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

export type CalendarEventCreateDto = {
  summary: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
};

export type SettingsDto = {
  profile: {
    name: string;
    email: string;
  };
  preferences: {
    name: string;
    timezone: string;
    workStart: string;
    workEnd: string;
    meetingPreference: string;
    interests: string;
    additionalContext: string;
    assistantNotes: string;
  };
  personalization: {
    completedAt: string | null;
  };
  advanced: {
    provider: string;
    model: string;
    toolResultVerbosity: "compact" | "verbose";
    sessionId: string;
    sessionStatus: string;
  };
};

export type SettingsUpdateDto = {
  profile?: Partial<SettingsDto["profile"]>;
  preferences?: Partial<SettingsDto["preferences"]>;
  personalization?: Partial<SettingsDto["personalization"]> & {
    markCompleted?: boolean;
  };
  advanced?: Partial<Pick<SettingsDto["advanced"], "provider" | "model" | "toolResultVerbosity">>;
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
      recipients?: string[];
      body?: string;
    };
  } | null;
  session: {
    hasBlockedTask: boolean;
  };
};

export type TaskStateDto = {
  taskState: {
    taskId: string;
    summary: string;
    status: string;
    activeSubgoal?: string;
    hasBlockedPrompt: boolean;
  } | null;
  clarification: AgentTurnDto["clarification"];
  confirmation: AgentTurnDto["confirmation"];
};

export type ChatHistoryDto = {
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: string;
  }>;
};

export type ApiErrorDto = {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    requestId?: string;
  };
};
