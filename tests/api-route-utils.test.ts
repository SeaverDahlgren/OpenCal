import { describe, expect, it } from "vitest";
import { buildChatHistoryRoutePayload, buildUtcDayBounds } from "../apps/api/src/routes/utils.js";
import type { StoredSessionState } from "../src/app/session-types.js";

describe("api route utils", () => {
  it("returns recent user and assistant chat history only", () => {
    const session: StoredSessionState = {
      sessionId: "sess-123",
      token: "token-123",
      user: { name: "Seaver", email: "seaver@example.com" },
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      toolResultVerbosity: "compact",
      createdAt: "2026-03-25T00:00:00.000Z",
      updatedAt: "2026-03-25T00:00:00.000Z",
      messages: [
        { role: "system", content: "hidden", timestamp: "2026-03-25T00:00:00.000Z" },
        { role: "user", content: "Hello", timestamp: "2026-03-25T00:01:00.000Z" },
        { role: "tool", content: "hidden tool", timestamp: "2026-03-25T00:02:00.000Z" },
        { role: "assistant", content: "Hi there", timestamp: "2026-03-25T00:03:00.000Z" },
      ],
      taskState: null,
      pendingConfirmation: null,
    };

    expect(buildChatHistoryRoutePayload(session)).toEqual({
      messages: [
        {
          id: "2026-03-25T00:01:00.000Z-user-0",
          role: "user",
          content: "Hello",
          timestamp: "2026-03-25T00:01:00.000Z",
        },
        {
          id: "2026-03-25T00:03:00.000Z-assistant-1",
          role: "assistant",
          content: "Hi there",
          timestamp: "2026-03-25T00:03:00.000Z",
        },
      ],
    });
  });

  it("builds explicit UTC day bounds for calendar queries", () => {
    expect(buildUtcDayBounds("2026-03-25")).toEqual({
      timeMin: "2026-03-25T00:00:00.000Z",
      timeMax: "2026-03-25T23:59:59.999Z",
    });
  });
});
