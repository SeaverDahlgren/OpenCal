import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createApiClient } from "../api/client";
import type { SessionDto } from "../api/types";

const TOKEN_KEY = "opencal.session.token";

type SessionContextValue = {
  token: string | null;
  session: SessionDto["session"] | null;
  loading: boolean;
  blocked: boolean;
  setToken: (token: string | null) => Promise<void>;
  refreshSession: () => Promise<void>;
  startAuth: () => Promise<void>;
  clearSession: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [session, setSession] = useState<SessionDto["session"] | null>(null);
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
      const result = await createApiClient(stored).getSession();
      setSession(result.session);
    } catch {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setTokenState(null);
      setSession(null);
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
      return;
    }
    const result = await createApiClient(next).getSession();
    setSession(result.session);
    router.replace("/(tabs)/today");
  }

  async function refreshSession() {
    if (!token) {
      setSession(null);
      return;
    }
    const result = await createApiClient(token).getSession();
    setSession(result.session);
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

  const value = useMemo(
    () => ({
      token,
      session,
      loading,
      blocked: Boolean(session?.hasBlockedTask),
      setToken,
      refreshSession,
      startAuth,
      clearSession,
    }),
    [loading, session, token],
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
