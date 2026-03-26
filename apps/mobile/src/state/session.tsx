import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createApiClient } from "../api/client";
import type { SessionDto, TaskStateDto } from "../api/types";

const TOKEN_KEY = "opencal.session.token";

type SessionContextValue = {
  token: string | null;
  session: SessionDto["session"] | null;
  taskState: TaskStateDto | null;
  loading: boolean;
  blocked: boolean;
  setToken: (token: string | null) => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshTaskState: () => Promise<void>;
  startAuth: () => Promise<void>;
  clearSession: () => Promise<void>;
  resetAgentSession: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [session, setSession] = useState<SessionDto["session"] | null>(null);
  const [taskState, setTaskState] = useState<TaskStateDto | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    const stored = await SecureStore.getItemAsync(TOKEN_KEY);
    setTokenState(stored);
    if (!stored) {
      setLoading(false);
      return;
    }

    try {
      const client = createApiClient(stored);
      const [result, nextTaskState] = await Promise.all([client.getSession(), client.getTaskState()]);
      setSession(result.session);
      setTaskState(nextTaskState);
    } catch {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setTokenState(null);
      setSession(null);
      setTaskState(null);
    } finally {
      setLoading(false);
    }
  }

  async function setToken(next: string | null) {
    if (next) {
      await SecureStore.setItemAsync(TOKEN_KEY, next);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
    setTokenState(next);
    if (!next) {
      setSession(null);
      setTaskState(null);
      return;
    }
    const client = createApiClient(next);
    const [result, nextTaskState] = await Promise.all([client.getSession(), client.getTaskState()]);
    setSession(result.session);
    setTaskState(nextTaskState);
    router.replace("/(tabs)/today");
  }

  async function refreshSession() {
    if (!token) {
      setSession(null);
      setTaskState(null);
      return;
    }
    const result = await createApiClient(token).getSession();
    setSession(result.session);
  }

  async function refreshTaskState() {
    if (!token) {
      setTaskState(null);
      return;
    }
    const result = await createApiClient(token).getTaskState();
    setTaskState(result);
  }

  async function startAuth() {
    const returnTo = Linking.createURL("auth-callback");
    const { authUrl } = await createApiClient(null).startGoogleAuth(returnTo);
    await Linking.openURL(authUrl);
  }

  async function clearSession() {
    await setToken(null);
    router.replace("/signin");
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
      loading,
      blocked: Boolean(taskState?.clarification || taskState?.confirmation || session?.hasBlockedTask),
      setToken,
      refreshSession,
      refreshTaskState,
      startAuth,
      clearSession,
      resetAgentSession,
    }),
    [loading, session, taskState, token],
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
