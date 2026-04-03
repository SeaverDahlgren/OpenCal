import { describe, expect, it } from "vitest";
import { shouldRetryGroqWithoutJsonMode } from "../src/llm/groq.js";

describe("Groq JSON fallback", () => {
  it("retries without response_format when Groq reports json validation failure", () => {
    expect(
      shouldRetryGroqWithoutJsonMode({
        error: {
          code: "json_validate_failed",
          message: "Failed to validate JSON.",
        },
      }),
    ).toBe(true);
  });

  it("does not retry for unrelated provider errors", () => {
    expect(
      shouldRetryGroqWithoutJsonMode({
        error: {
          code: "invalid_request_error",
          message: "Other failure",
        },
      }),
    ).toBe(false);
    expect(shouldRetryGroqWithoutJsonMode(null)).toBe(false);
  });
});
