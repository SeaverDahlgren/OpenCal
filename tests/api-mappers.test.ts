import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  mapCalendarDayView,
  mapCalendarMonthView,
  mapSettingsView,
  mapTodayOverview,
  updateUserMarkdown,
} from "../apps/api/src/dto/mappers.js";

describe("api dto mappers", () => {
  it("maps today overview into display-ready schedule cards", () => {
    const result = mapTodayOverview({
      date: "2026-03-25",
      timezone: "America/Los_Angeles",
      events: [
        {
          id: "evt-1",
          summary: "Morning Sync",
          start: "2026-03-25T16:00:00.000Z",
          end: "2026-03-25T16:30:00.000Z",
          attendees: ["alex@example.com", undefined, "sam@example.com"],
        },
      ],
    });

    expect(result.schedule).toEqual([
      expect.objectContaining({
        eventId: "evt-1",
        title: "Morning Sync",
        attendeePreview: ["alex@example.com", "sam@example.com"],
        calendarId: "primary",
      }),
    ]);
  });

  it("maps a month view into dense day cells with counts and highlights", () => {
    const result = mapCalendarMonthView({
      year: 2026,
      month: 3,
      timezone: "America/Los_Angeles",
      events: [
        { start: "2026-03-03T16:00:00.000Z" },
        { start: "2026-03-03T18:00:00.000Z" },
      ],
    });

    expect(result.days).toHaveLength(42);
    expect(result.monthLabel).toBe("March 2026");
    expect(result.days.find((day) => day.date === "2026-03-03")).toEqual(
      expect.objectContaining({
        eventCount: 2,
        highlights: [{ tone: "primary" }, { tone: "tertiary" }],
      }),
    );
  });

  it("maps settings and persists markdown preference updates", () => {
    const markdown = [
      "name: Avery",
      "timezone: America/Los_Angeles",
      "workStart: 09:00",
      "workEnd: 17:00",
      "meetingPreference: Afternoons preferred",
      "assistantNotes: Protect mornings",
      "",
    ].join("\n");

    const settings = mapSettingsView({
      userMarkdown: markdown,
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      verbosity: "compact",
      sessionId: "sess-123",
      user: {
        name: "Avery",
        email: "avery@example.com",
      },
    });

    expect(settings.preferences).toEqual({
      name: "Avery",
      timezone: "America/Los_Angeles",
      workStart: "09:00",
      workEnd: "17:00",
      meetingPreference: "Afternoons preferred",
      assistantNotes: "Protect mornings",
    });

    const updated = updateUserMarkdown(markdown, {
      name: "Avery Mercer",
      workStart: "08:00",
      assistantNotes: "Save mornings for workouts",
    });

    expect(updated).toContain("name: Avery Mercer");
    expect(updated).toContain("workStart: 08:00");
    expect(updated).toContain("assistantNotes: Save mornings for workouts");
  });

  it("maps day events into attendee-ready timeline cards", () => {
    const result = mapCalendarDayView({
      date: "2026-03-25",
      timezone: "America/Los_Angeles",
      events: [
        {
          id: "evt-1",
          summary: "Design Review",
          start: "2026-03-25T19:00:00.000Z",
          end: "2026-03-25T20:00:00.000Z",
          attendees: ["alex@example.com", null, "dan@example.com"],
        },
      ],
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        title: "Design Review",
        attendees: [
          { name: "alex@example.com", email: "alex@example.com" },
          { name: "dan@example.com", email: "dan@example.com" },
        ],
      }),
    );
  });
});
