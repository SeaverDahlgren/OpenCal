import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiRequestError, createApiClient } from "./api/client";
import type {
  AgentTurnDto,
  ChatHistoryDto,
  SessionDto,
  SettingsDto,
  TaskStateDto,
  TodayDto,
  CalendarMonthDto,
  CalendarDayDto,
} from "./api/types";
import { AppLogo } from "./components/AppLogo";
import { CalendarPanel } from "./components/CalendarPanel";
import { ChatPanel } from "./components/ChatPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { SignInPanel } from "./components/SignInPanel";
import { TodayPanel } from "./components/TodayPanel";

const TOKEN_KEY = "opencal.web.session.token";

type ViewName = "today" | "calendar" | "settings";

export function App() {
  const [token, setToken] = useState<string | null>(() => window.localStorage.getItem(TOKEN_KEY));
  const [session, setSession] = useState<SessionDto["session"] | null>(null);
  const [taskState, setTaskState] = useState<TaskStateDto | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatHistoryDto["messages"]>([]);
  const [today, setToday] = useState<TodayDto | null>(null);
  const [month, setMonth] = useState<CalendarMonthDto | null>(null);
  const [day, setDay] = useState<CalendarDayDto | null>(null);
  const [settings, setSettings] = useState<SettingsDto | null>(null);
  const [view, setView] = useState<ViewName>("today");
  const [authError, setAuthError] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingToday, setLoadingToday] = useState(false);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [todayError, setTodayError] = useState<string | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null);
  const [scheduleVersion, setScheduleVersion] = useState(0);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => toDateOnly(new Date()));

  useEffect(() => {
    const url = new URL(window.location.href);
    const sessionToken = url.searchParams.get("sessionToken");
    const errorCode = url.searchParams.get("errorCode");
    const errorMessage = url.searchParams.get("errorMessage");
    if (sessionToken) {
      window.localStorage.setItem(TOKEN_KEY, sessionToken);
      setToken(sessionToken);
      setAuthError(null);
      stripAuthParams(url);
    } else if (errorCode || errorMessage) {
      setAuthError(errorMessage ?? errorCode ?? "Authentication failed.");
      stripAuthParams(url);
    }
  }, []);

  const pendingTurn = useMemo(() => derivePendingTurn(taskState), [taskState]);

  const loadSessionSnapshot = useCallback(async (nextToken: string) => {
    const client = createApiClient(nextToken);
    const [nextSession, nextTaskState, nextHistory] = await Promise.all([
      client.getSession(),
      client.getTaskState(),
      client.getChatHistory(),
    ]);
    setSession(nextSession.session);
    setTaskState(nextTaskState);
    setChatHistory(nextHistory.messages);
  }, []);

  const clearClientSession = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setSession(null);
    setTaskState(null);
    setChatHistory([]);
    setToday(null);
    setMonth(null);
    setDay(null);
    setSettings(null);
  }, []);

  useEffect(() => {
    if (!token) {
      setLoadingSession(false);
      return;
    }
    setLoadingSession(true);
    void loadSessionSnapshot(token)
      .catch((error) => {
        if (error instanceof ApiRequestError) {
          setAuthError(error.message);
        }
        clearClientSession();
      })
      .finally(() => setLoadingSession(false));
  }, [clearClientSession, loadSessionSnapshot, token]);

  const loadToday = useCallback(async () => {
    if (!token) {
      return;
    }
    setLoadingToday(true);
    setTodayError(null);
    try {
      setToday(await createApiClient(token).getToday());
    } catch (error) {
      setTodayError(error instanceof Error ? error.message : "Failed to load today.");
    } finally {
      setLoadingToday(false);
    }
  }, [token]);

  const loadCalendar = useCallback(async (targetMonth: Date, focusDate: string) => {
    if (!token) {
      return;
    }
    setLoadingCalendar(true);
    setCalendarError(null);
    try {
      const client = createApiClient(token);
      const [nextMonth, nextDay] = await Promise.all([
        client.getCalendarMonth(targetMonth.getFullYear(), targetMonth.getMonth() + 1),
        client.getCalendarDay(focusDate),
      ]);
      setMonth(nextMonth);
      setDay(nextDay);
      setVisibleMonth(targetMonth);
      setSelectedDate(focusDate);
    } catch (error) {
      setCalendarError(error instanceof Error ? error.message : "Failed to load calendar.");
    } finally {
      setLoadingCalendar(false);
    }
  }, [token]);

  const loadSettings = useCallback(async () => {
    if (!token) {
      return;
    }
    setLoadingSettings(true);
    setSettingsError(null);
    try {
      setSettings(await createApiClient(token).getSettings());
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Failed to load settings.");
    } finally {
      setLoadingSettings(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }
    void loadToday();
    void loadCalendar(visibleMonth, selectedDate);
    void loadSettings();
  }, [loadCalendar, loadSettings, loadToday, token]);

  useEffect(() => {
    if (!token || scheduleVersion === 0) {
      return;
    }
    void loadToday();
    void loadCalendar(visibleMonth, selectedDate);
  }, [loadCalendar, loadToday, scheduleVersion, selectedDate, token, visibleMonth]);

  async function startAuth() {
    const { authUrl } = await createApiClient(null).startGoogleAuth(window.location.origin);
    window.location.assign(authUrl);
  }

  async function signOut() {
    if (token) {
      try {
        await createApiClient(token).revokeSession();
      } catch {
        // Best-effort revoke.
      }
    }
    clearClientSession();
  }

  async function saveSettings() {
    if (!token || !settings) {
      return;
    }
    setSavingSettings(true);
    setSettingsError(null);
    setSettingsNotice(null);
    try {
      const next = await createApiClient(token).updateSettings(settings);
      setSettings(next);
      setSettingsNotice("Settings saved.");
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Failed to save settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function resetAgentSession() {
    if (!token) {
      return;
    }
    setSettingsError(null);
    setSettingsNotice(null);
    try {
      await fetchWithAuth(token, "/session/reset");
      await loadSessionSnapshot(token);
      setSettingsNotice("Agent session reset.");
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Failed to reset the agent session.");
    }
  }

  async function sendAgentAction(input: { message?: string; action?: "confirm" | "cancel"; optionValue?: string }) {
    if (!token) {
      return;
    }
    setChatSending(true);
    setChatError(null);
    try {
      await createApiClient(token).sendAgentMessage(input);
      await loadSessionSnapshot(token);
      setScheduleVersion((value) => value + 1);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Failed to send that message.");
    } finally {
      setChatSending(false);
    }
  }

  async function moveMonth(offset: number) {
    const targetMonth = startOfMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1));
    const focusDate = toDateOnly(new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1, 12));
    await loadCalendar(targetMonth, focusDate);
  }

  async function jumpToToday() {
    const todayDate = new Date();
    await loadCalendar(startOfMonth(todayDate), toDateOnly(todayDate));
  }

  async function selectDay(date: string) {
    await loadCalendar(startOfMonth(new Date(`${date}T12:00:00`)), date);
  }

  if (!token || !session) {
    return <SignInPanel loading={loadingSession} authError={authError} onSignIn={startAuth} />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__brand">
          <AppLogo />
          <div>
            <p className="eyebrow">OPENCAL REVIEW BUILD</p>
            <h1>OpenCal</h1>
          </div>
        </div>
        <div className="topbar__meta">
          <p>{session.user.name}</p>
          <p className="muted">{session.user.email}</p>
        </div>
      </header>
      <main className="dashboard">
        <section className="dashboard__main">
          <nav className="tabbar">
            {(["today", "calendar", "settings"] as const).map((item) => (
              <button
                className={`tabbar__item${view === item ? " tabbar__item--active" : ""}`}
                key={item}
                onClick={() => setView(item)}
              >
                {item === "today" ? "Today" : item === "calendar" ? "Calendar" : "Settings"}
              </button>
            ))}
          </nav>
          {view === "today" ? (
            <TodayPanel
              data={today}
              loading={loadingToday}
              error={todayError}
              onRefresh={loadToday}
              onPrompt={(prompt) => {
                setQueuedPrompt(prompt);
              }}
            />
          ) : null}
          {view === "calendar" ? (
            <CalendarPanel
              month={month}
              day={day}
              monthDate={visibleMonth}
              selectedDate={selectedDate}
              loading={loadingCalendar}
              error={calendarError}
              onPrev={() => moveMonth(-1)}
              onNext={() => moveMonth(1)}
              onToday={jumpToToday}
              onSelectDay={selectDay}
              onRefresh={() => loadCalendar(visibleMonth, selectedDate)}
              onPrompt={(prompt) => setQueuedPrompt(prompt)}
            />
          ) : null}
          {view === "settings" ? (
            <SettingsPanel
              data={settings}
              loading={loadingSettings}
              saving={savingSettings}
              error={settingsError}
              notice={settingsNotice}
              onChange={setSettings}
              onSave={saveSettings}
              onRefresh={loadSettings}
              onResetSession={resetAgentSession}
              onSignOut={signOut}
            />
          ) : null}
        </section>
        <ChatPanel
          history={chatHistory}
          pendingTurn={pendingTurn}
          sending={chatSending}
          error={chatError}
          defaultPrompt={queuedPrompt}
          onSubmit={async (input) => {
            await sendAgentAction(input);
            if (input.message || input.optionValue || input.action) {
              setQueuedPrompt(null);
            }
          }}
        />
      </main>
    </div>
  );
}

function derivePendingTurn(taskState: TaskStateDto | null): AgentTurnDto | null {
  if (!taskState?.clarification && !taskState?.confirmation) {
    return null;
  }
  return {
    assistant: {
      message: "",
    },
    clarification: taskState.clarification,
    confirmation: taskState.confirmation,
    session: {
      hasBlockedTask: taskState.taskState?.hasBlockedPrompt ?? false,
    },
  };
}

function stripAuthParams(url: URL) {
  url.searchParams.delete("sessionToken");
  url.searchParams.delete("sessionId");
  url.searchParams.delete("errorCode");
  url.searchParams.delete("errorMessage");
  window.history.replaceState({}, document.title, url.toString());
}

async function fetchWithAuth(token: string, path: string) {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8787/api/v1"}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-opencal-app-version": (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "1.0.0",
      "x-opencal-platform": "web",
    },
  });
  if (!response.ok) {
    const payload = await response.json() as { error?: { message?: string } };
    throw new Error(payload.error?.message ?? "Request failed.");
  }
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1, 12);
}

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}
