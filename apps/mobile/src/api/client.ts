import type {
  AgentTurnDto,
  ApiErrorDto,
  CalendarDayDto,
  CalendarMonthDto,
  ChatHistoryDto,
  SessionDto,
  SettingsDto,
  TaskStateDto,
  TodayDto,
} from "./types";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8787/api/v1";

export class ApiClient {
  constructor(private readonly token?: string | null) {}

  async getSession() {
    return this.request<SessionDto>("/session");
  }

  async getToday() {
    return this.request<TodayDto>("/today");
  }

  async getCalendarMonth(year: number, month: number) {
    return this.request<CalendarMonthDto>(`/calendar/month?year=${year}&month=${month}`);
  }

  async getCalendarDay(date: string) {
    return this.request<CalendarDayDto>(`/calendar/day?date=${date}`);
  }

  async getSettings() {
    return this.request<SettingsDto>("/settings");
  }

  async updateSettings(input: Partial<SettingsDto>) {
    return this.request<SettingsDto>("/settings", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async startGoogleAuth(returnTo: string) {
    return this.request<{ authUrl: string }>("/auth/google/start", {
      method: "POST",
      body: JSON.stringify({ returnTo }),
    });
  }

  async reuseGoogleAuth() {
    return this.request<{
      sessionToken: string;
      sessionId: string;
      user: { name: string; email: string };
    }>("/auth/google/reuse", {
      method: "POST",
    });
  }

  async sendAgentMessage(body: { message?: string; action?: "confirm" | "cancel"; optionValue?: string }) {
    return this.request<AgentTurnDto>("/agent/turn", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async getTaskState() {
    return this.request<TaskStateDto>("/agent/task-state");
  }

  async getChatHistory() {
    return this.request<ChatHistoryDto>("/agent/history");
  }

  async resetSession() {
    return this.request<{ ok: boolean; sessionId: string }>("/session/reset", {
      method: "POST",
    });
  }

  async revokeSession() {
    return this.request<{ ok: boolean; sessionId: string }>("/session/revoke", {
      method: "POST",
    });
  }

  private async request<T>(path: string, init: RequestInit = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        ...(init.headers ?? {}),
      },
    });

    const payload = (await response.json()) as T | ApiErrorDto;
    if (!response.ok) {
      throw new Error((payload as ApiErrorDto).error?.message ?? "API request failed.");
    }
    return payload as T;
  }
}

export function createApiClient(token?: string | null) {
  return new ApiClient(token);
}
