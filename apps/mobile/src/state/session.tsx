import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createApiClient } from "../api/client";
import type { AgentTurnDto, ChatHistoryDto, SessionDto, TaskStateDto } from "../api/types";
import { derivePendingTurn, hasBlockedUiState, type AgentActionInput } from "./session-view";

const TOKEN_KEY = "opencal.session.token";
const SIGNED_OUT_KEY = "opencal.session.signedOut";

type SessionContextValue = {
  token: string | null;
  session: SessionDto["session"] | null;
  taskState: TaskStateDto | null;
  chatHistory: ChatHistoryDto["messages"];
  pendingTurn: AgentTurnDto | null;
  scheduleVersion: number;
  loading: boolean;
  blocked: boolean;
  setToken: (token: string | null) => Promise<void>;
  sendAgentAction: (input: AgentActionInput) => Promise<AgentTurnDto | null>;
  refreshSession: () => Promise<void>;
  refreshTaskState: () => Promise<void>;
  refreshChatHistory: () => Promise<void>;
  startAuth: () => Promise<void>;
  clearSession: () => Promise<void>;
  resetAgentSession: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [session, setSession] = useState<SessionDto["session"] | null>(null);
  const [taskState, setTaskState] = useState<TaskStateDto | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatHistoryDto["messages"]>([]);
  const [pendingTurn, setPendingTurn] = useState<AgentTurnDto | null>(null);
  const [scheduleVersion, setScheduleVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    const stored = await SecureStore.getItemAsync(TOKEN_KEY);
    const signedOut = (await SecureStore.getItemAsync(SIGNED_OUT_KEY)) === "true";
    setTokenState(stored);
    if (!stored) {
      if (signedOut) {
        setLoading(false);
        return;
      }
      try {
        const reused = await createApiClient(null).reuseGoogleAuth();
        await SecureStore.setItemAsync(TOKEN_KEY, reused.sessionToken);
        await SecureStore.deleteItemAsync(SIGNED_OUT_KEY);
        setTokenState(reused.sessionToken);
        const client = createApiClient(reused.sessionToken);
        const [result, nextTaskState, history] = await Promise.all([
          client.getSession(),
          client.getTaskState(),
          client.getChatHistory(),
        ]);
        applySessionSnapshot(result.session, nextTaskState, history.messages);
      } catch {
        setLoading(false);
        return;
      }
      setLoading(false);
      return;
    }

    try {
      const client = createApiClient(stored);
      const [result, nextTaskState, history] = await Promise.all([
        client.getSession(),
        client.getTaskState(),
        client.getChatHistory(),
      ]);
      applySessionSnapshot(result.session, nextTaskState, history.messages);
    } catch {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setTokenState(null);
      setSession(null);
      setTaskState(null);
      setChatHistory([]);
      setPendingTurn(null);
    } finally {
      setLoading(false);
    }
  }

  function applySessionSnapshot(
    nextSession: SessionDto["session"] | null,
    nextTaskState: TaskStateDto | null,
    nextChatHistory: ChatHistoryDto["messages"] = [],
  ) {
    setSession(nextSession);
    setTaskState(nextTaskState);
    setChatHistory(nextChatHistory);
    setPendingTurn(derivePendingTurn(nextTaskState));
  }

  async function setToken(next: string | null) {
    if (next) {
      await SecureStore.setItemAsync(TOKEN_KEY, next);
      await SecureStore.deleteItemAsync(SIGNED_OUT_KEY);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
    setTokenState(next);
    if (!next) {
      applySessionSnapshot(null, null, []);
      return;
    }
    const client = createApiClient(next);
    const [result, nextTaskState, history] = await Promise.all([
      client.getSession(),
      client.getTaskState(),
      client.getChatHistory(),
    ]);
    applySessionSnapshot(result.session, nextTaskState, history.messages);
    router.replace("/(tabs)/today");
  }

  async function refreshSession() {
    if (!token) {
      setSession(null);
      setTaskState(null);
      setChatHistory([]);
      return;
    }
    const result = await createApiClient(token).getSession();
    setSession(result.session);
  }

  async function refreshTaskState() {
    if (!token) {
      setTaskState(null);
      setPendingTurn(null);
      return;
    }
    const result = await createApiClient(token).getTaskState();
    setTaskState(result);
    setPendingTurn(derivePendingTurn(result));
  }

  async function refreshChatHistory() {
    if (!token) {
      setChatHistory([]);
      return;
    }
    const result = await createApiClient(token).getChatHistory();
    setChatHistory(result.messages);
  }

  async function startAuth() {
    await SecureStore.deleteItemAsync(SIGNED_OUT_KEY);
    const returnTo = Linking.createURL("auth-callback");
    const { authUrl } = await createApiClient(null).startGoogleAuth(returnTo);
    await Linking.openURL(authUrl);
  }

  async function clearSession() {
    if (token) {
      try {
        await createApiClient(token).revokeSession();
      } catch {
        // Best-effort server-side revoke; local sign-out still proceeds.
      }
    }
    await SecureStore.setItemAsync(SIGNED_OUT_KEY, "true");
    await setToken(null);
    router.replace("/signin");
  }

  async function sendAgentAction(input: AgentActionInput) {
    if (!token) {
      return null;
    }
    const client = createApiClient(token);
    const next = await client.sendAgentMessage(input);
    await Promise.all([refreshSession(), refreshTaskState(), refreshChatHistory()]);
    setScheduleVersion((value) => value + 1);
    return next;
  }

  async function resetAgentSession() {
    if (!token) {
      return;
    }
    await createApiClient(token).resetSession();
    await Promise.all([refreshSession(), refreshTaskState()]);
  }

  const value = useMemo(
    () => ({
      token,
      session,
      taskState,
      chatHistory,
      pendingTurn,
      scheduleVersion,
      loading,
      blocked: hasBlockedUiState(session, pendingTurn),
      setToken,
      sendAgentAction,
      refreshSession,
      refreshTaskState,
      refreshChatHistory,
      startAuth,
      clearSession,
      resetAgentSession,
    }),
    [chatHistory, loading, pendingTurn, scheduleVersion, session, taskState, token],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return value;
}
