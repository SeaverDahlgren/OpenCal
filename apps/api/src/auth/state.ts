export type AuthStatePayload = {
  returnTo?: string;
};

export function encodeAuthState(payload: AuthStatePayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeAuthState(value: string | null) {
  if (!value) {
    return {};
  }

  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as AuthStatePayload;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export function buildMobileReturnUrl(
  returnTo: string | undefined,
  session: { token: string; sessionId: string },
) {
  if (!returnTo) {
    return null;
  }

  try {
    const url = new URL(returnTo);
    url.searchParams.set("sessionToken", session.token);
    url.searchParams.set("sessionId", session.sessionId);
    return url.toString();
  } catch {
    return null;
  }
}
