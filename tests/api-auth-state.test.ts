import { describe, expect, it } from "vitest";
import {
  buildMobileReturnUrl,
  decodeAuthState,
  encodeAuthState,
} from "../apps/api/src/auth/state.js";

const stateConfig = {
  appEnv: "development" as const,
  stateEncryptionKey: "secret-key",
  googleClientSecret: "google-client-secret",
  allowedReturnToPrefixes: [],
};

describe("api auth state", () => {
  it("round-trips the encoded auth state payload", () => {
    const encoded = encodeAuthState(stateConfig, {
      returnTo: "opencal://auth-callback",
    });

    expect(decodeAuthState(stateConfig, encoded)).toEqual({
      returnTo: "opencal://auth-callback",
    });
  });

  it("builds a deep link return url with the session token", () => {
    const url = buildMobileReturnUrl(stateConfig, "opencal://auth-callback", {
      token: "token-123",
      sessionId: "sess-123",
    });

    expect(url).toBe("opencal://auth-callback?sessionToken=token-123&sessionId=sess-123");
  });

  it("rejects invalid or expired auth state and invalid return urls", () => {
    expect(decodeAuthState(stateConfig, "not-valid")).toEqual({});
    const encoded = encodeAuthState(stateConfig, {
      returnTo: "opencal://auth-callback",
    });
    expect(decodeAuthState(stateConfig, encoded, "2026-03-26T20:20:00.000Z")).toEqual({});
    expect(
      buildMobileReturnUrl({
        appEnv: "development",
        allowedReturnToPrefixes: [],
      } as never, "%%%not-a-url%%%", {
        token: "token-123",
        sessionId: "sess-123",
      }),
    ).toBeNull();
  });

  it("rejects tampered auth state", () => {
    const encoded = encodeAuthState(stateConfig, {
      returnTo: "opencal://auth-callback",
    });
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
      payload: { returnTo?: string };
      issuedAt: string;
      signature: string;
    };
    parsed.payload.returnTo = "opencal://evil";
    const tampered = Buffer.from(JSON.stringify(parsed), "utf8").toString("base64url");

    expect(decodeAuthState(stateConfig, tampered)).toEqual({});
  });

  it("rejects unapproved return targets unless explicitly allowlisted", () => {
    expect(
      buildMobileReturnUrl(stateConfig, "https://evil.example.com/callback", {
        token: "token-123",
        sessionId: "sess-123",
      }),
    ).toBeNull();

    expect(
      buildMobileReturnUrl(
        {
          ...stateConfig,
          appEnv: "production",
          allowedReturnToPrefixes: ["https://app.example.com/auth"],
        },
        "https://app.example.com/auth/callback",
        {
          token: "token-123",
          sessionId: "sess-123",
        },
      ),
    ).toBe("https://app.example.com/auth/callback?sessionToken=token-123&sessionId=sess-123");
  });
});
