import { describe, expect, it } from "vitest";
import { toUserFacingLlmErrorMessage } from "../src/llm/errors.js";

describe("toUserFacingLlmErrorMessage", () => {
  it("maps structured 503 errors to a retry message", () => {
    const message = toUserFacingLlmErrorMessage(
      '{"error":{"code":503,"message":"high demand","status":"UNAVAILABLE"}}',
    );

    expect(message).toBe("The model is temporarily unavailable right now. Please try again in a minute.");
  });

  it("maps TooManyRequests variants to a retry message", () => {
    const message = toUserFacingLlmErrorMessage(
      '{"error":{"code":"TooManyRequests","message":"rate limited","status":"TooManyRequests"}}',
    );

    expect(message).toBe("The model is temporarily unavailable right now. Please try again in a minute.");
  });

  it("maps generic provider failures to a config-oriented fallback", () => {
    const message = toUserFacingLlmErrorMessage(new Error("bad api key"));

    expect(message).toBe(
      "The model request failed, so I couldn't finish that turn. Check your API credentials/config and try again.",
    );
  });
});
