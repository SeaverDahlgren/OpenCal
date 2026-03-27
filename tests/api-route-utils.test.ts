import { describe, expect, it } from "vitest";
import { buildChatHistoryRoutePayload, buildTaskStateRoutePayload, buildUtcDayBounds } from "../apps/api/src/routes/utils.js";
import type { StoredSessionState } from "../src/app/session-types.js";

describe("api route utils", () => {
  it("returns recent user and assistant chat history only", () => {
    const session: StoredSessionState = {
      sessionId: "sess-123",
      token: "token-123",
      user: { name: "Avery", email: "avery@example.com" },
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

  it("builds specific confirmation prompts for create_event", () => {
    const session = baseSession({
      toolName: "create_event",
      arguments: {
        title: "Lunch with Joe",
        start: "2026-03-27T12:00:00-07:00",
      },
    });

    expect(buildTaskStateRoutePayload(session).confirmation).toMatchObject({
      prompt: 'Please confirm: should I create "Lunch with Joe" starting at 2026-03-27T12:00:00-07:00?',
      payloadPreview: {
        summary: 'create "Lunch with Joe" starting at 2026-03-27T12:00:00-07:00',
      },
    });
  });

  it("builds specific confirmation prompts for write_draft", () => {
    const session = baseSession({
      toolName: "write_draft",
      arguments: {
        subject: "Reschedule request",
        to: ["sarah@example.com"],
        body: "Hi Sarah,\n\nCould we move our meeting to Thursday afternoon?\n\nThanks,\nAvery",
      },
    });

    expect(buildTaskStateRoutePayload(session).confirmation).toMatchObject({
      prompt: 'Please confirm: should I create the draft "Reschedule request"?',
      payloadPreview: {
        summary: 'create the draft "Reschedule request"',
        subject: "Reschedule request",
        recipients: ["sarah@example.com"],
        body: "Hi Sarah,\n\nCould we move our meeting to Thursday afternoon?\n\nThanks,\nAvery",
      },
    });
  });

  it("builds specific confirmation prompts for delete_event", () => {
    const session = baseSession({
      toolName: "delete_event",
      arguments: {
        title: "Swim Practice",
      },
    });

    expect(buildTaskStateRoutePayload(session).confirmation).toMatchObject({
      prompt: 'Please confirm: should I delete "Swim Practice"?',
      payloadPreview: {
        summary: 'delete "Swim Practice"',
      },
    });
  });
});

function baseSession(pendingConfirmation: StoredSessionState["pendingConfirmation"]): StoredSessionState {
  return {
    sessionId: "sess-123",
    token: "token-123",
    user: { name: "Avery", email: "avery@example.com" },
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    toolResultVerbosity: "compact",
    createdAt: "2026-03-25T00:00:00.000Z",
    updatedAt: "2026-03-25T00:00:00.000Z",
    messages: [],
    taskState: null,
    pendingConfirmation,
  };
}
