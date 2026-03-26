import { describe, expect, it } from "vitest";
import {
  buildMobileReturnUrl,
  decodeAuthState,
  encodeAuthState,
} from "../apps/api/src/auth/state.js";

describe("api auth state", () => {
  it("round-trips the encoded auth state payload", () => {
    const encoded = encodeAuthState({
      returnTo: "opencal://auth-callback",
    });

    expect(decodeAuthState(encoded)).toEqual({
      returnTo: "opencal://auth-callback",
    });
  });

  it("builds a deep link return url with the session token", () => {
    const url = buildMobileReturnUrl("opencal://auth-callback", {
      token: "token-123",
      sessionId: "sess-123",
    });

    expect(url).toBe("opencal://auth-callback?sessionToken=token-123&sessionId=sess-123");
  });

  it("ignores invalid auth state and invalid return urls", () => {
    expect(decodeAuthState("not-valid")).toEqual({});
    expect(
      buildMobileReturnUrl("%%%not-a-url%%%", {
        token: "token-123",
        sessionId: "sess-123",
      }),
    ).toBeNull();
  });
});
