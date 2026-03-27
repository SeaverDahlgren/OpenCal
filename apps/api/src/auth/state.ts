import crypto from "node:crypto";
import type { AppConfig } from "../../../../src/config/env.js";

const AUTH_STATE_TTL_MS = 10 * 60 * 1000;

export type AuthStatePayload = {
  returnTo?: string;
};

type SignedAuthState = {
  payload: AuthStatePayload;
  issuedAt: string;
  signature: string;
};

export function encodeAuthState(config: Pick<AppConfig, "stateEncryptionKey" | "googleClientSecret">, payload: AuthStatePayload) {
  const signed: SignedAuthState = {
    payload,
    issuedAt: new Date().toISOString(),
    signature: "",
  };
  signed.signature = signState(config, signed.payload, signed.issuedAt);
  return Buffer.from(JSON.stringify(signed), "utf8").toString("base64url");
}

export function decodeAuthState(
  config: Pick<AppConfig, "stateEncryptionKey" | "googleClientSecret">,
  value: string | null,
  nowIso = new Date().toISOString(),
) {
  if (!value) {
    return {};
  }

  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as SignedAuthState;
    if (!parsed?.issuedAt || !parsed?.signature || !parsed?.payload) {
      return {};
    }
    if (isExpired(parsed.issuedAt, nowIso)) {
      return {};
    }
    const expected = signState(config, parsed.payload, parsed.issuedAt);
    const valid = crypto.timingSafeEqual(Buffer.from(parsed.signature), Buffer.from(expected));
    return valid ? parsed.payload : {};
  } catch {
    return {};
  }
}

export function buildMobileReturnUrl(
  config: Pick<AppConfig, "appEnv" | "allowedReturnToPrefixes">,
  returnTo: string | undefined,
  session: { token: string; sessionId: string },
) {
  if (!returnTo) {
    return null;
  }

  try {
    const url = new URL(returnTo);
    if (!isAllowedReturnTarget(config, url)) {
      return null;
    }
    url.searchParams.set("sessionToken", session.token);
    url.searchParams.set("sessionId", session.sessionId);
    return url.toString();
  } catch {
    return null;
  }
}

function signState(
  config: Pick<AppConfig, "stateEncryptionKey" | "googleClientSecret">,
  payload: AuthStatePayload,
  issuedAt: string,
) {
  const secret = config.stateEncryptionKey || config.googleClientSecret;
  return crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify({ payload, issuedAt }))
    .digest("hex");
}

function isExpired(issuedAtIso: string, nowIso: string) {
  const ageMs = new Date(nowIso).getTime() - new Date(issuedAtIso).getTime();
  return !Number.isFinite(ageMs) || ageMs < 0 || ageMs > AUTH_STATE_TTL_MS;
}

function isAllowedReturnTarget(
  config: Pick<AppConfig, "appEnv" | "allowedReturnToPrefixes">,
  url: URL,
) {
  const normalized = url.toString();
  const defaultPrefixes = ["opencal://", "exp://", "exps://"];
  if (defaultPrefixes.some((prefix) => normalized.startsWith(prefix))) {
    return true;
  }
  if (
    config.appEnv === "development" &&
    (url.protocol === "http:" || url.protocol === "https:") &&
    (url.hostname === "127.0.0.1" || url.hostname === "localhost")
  ) {
    return true;
  }
  return config.allowedReturnToPrefixes.some((prefix) => normalized.startsWith(prefix));
}
