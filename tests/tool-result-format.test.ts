import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { formatToolResultMessage } from "../src/agent/tool-result-format.js";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("formatToolResultMessage", () => {
  it("compacts search_events output into a short event list", () => {
    const message = formatToolResultMessage(
      "search_events",
      {
        ok: true,
        summary: "Found 2 events.",
        data: [
          {
            id: "evt-1",
            calendarId: "primary",
            summary: "Swim Practice",
            start: "2026-03-26T06:00:00-07:00",
            end: "2026-03-26T07:00:00-07:00",
          },
          {
            id: "evt-2",
            calendarId: "primary",
            summary: "Technique Swim",
            start: "2026-03-29T06:00:00-07:00",
            end: "2026-03-29T07:00:00-07:00",
          },
        ],
      },
      "compact",
    );

    expect(message).toContain("search_events: Found 2 events.");
    expect(message).toContain("evt-1 | Swim Practice");
    expect(message).not.toContain('"calendarId": "primary"');
    expect(message).not.toContain("[");
  });

  it("compacts find_time_slots output into a short slot list", () => {
    const message = formatToolResultMessage(
      "find_time_slots",
      {
        ok: true,
        summary: "Found 2 free time slots.",
        data: [
          {
            start: "2026-03-26T13:00:00-07:00",
            end: "2026-03-26T13:30:00-07:00",
          },
          {
            start: "2026-03-26T15:00:00-07:00",
            end: "2026-03-26T15:30:00-07:00",
          },
        ],
      },
      "compact",
    );

    expect(message).toContain("find_time_slots: Found 2 free time slots.");
    expect(message).toContain("2026-03-26T13:00:00-07:00 -> 2026-03-26T13:30:00-07:00");
    expect(message).not.toContain("[");
  });

  it("keeps verbose mode as the current summary plus full json payload", () => {
    const message = formatToolResultMessage(
      "write_draft",
      {
        ok: true,
        summary: "Draft created.",
        data: {
          id: "draft-1",
          messageId: "msg-1",
          to: ["joe@example.com"],
          subject: "Rescheduling",
        },
      },
      "verbose",
    );

    expect(message).toContain("write_draft: Draft created.");
    expect(message).toContain('"messageId": "msg-1"');
    expect(message).toContain('"to": [');
  });
});

describe("loadConfig", () => {
  it("defaults tool result verbosity to compact", () => {
    process.env = {
      ...originalEnv,
      GOOGLE_OAUTH_CLIENT_ID: "client-id",
      GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
    };

    const config = loadConfig(process.cwd());

    expect(config.toolResultVerbosity).toBe("compact");
  });
});
