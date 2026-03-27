import { describe, expect, it } from "vitest";
import { mapCalendarDayView, mapCalendarMonthView, mapTodayOverview } from "../apps/api/src/dto/calendar.js";

describe("calendar dto mappers", () => {
  it("counts month events by local timezone day", () => {
    const month = mapCalendarMonthView({
      year: 2026,
      month: 4,
      timezone: "America/Los_Angeles",
      events: [
        { start: "2026-04-01T00:30:00.000Z" },
        { start: "2026-04-01T18:00:00.000Z" },
      ],
    });

    const march31 = month.days.find((day) => day.date === "2026-03-31");
    const april1 = month.days.find((day) => day.date === "2026-04-01");

    expect(march31?.eventCount).toBe(1);
    expect(april1?.eventCount).toBe(1);
  });

  it("filters today schedule by local timezone day", () => {
    const overview = mapTodayOverview({
      date: "2026-03-31",
      timezone: "America/Los_Angeles",
      events: [
        {
          id: "evt-1",
          summary: "Late UTC event",
          start: "2026-04-01T00:30:00.000Z",
          end: "2026-04-01T01:00:00.000Z",
        },
        {
          id: "evt-2",
          summary: "Next local day",
          start: "2026-04-01T08:00:00.000Z",
          end: "2026-04-01T09:00:00.000Z",
        },
      ],
    });

    expect(overview.schedule.map((event) => event.eventId)).toEqual(["evt-1"]);
  });

  it("filters day items by local timezone day", () => {
    const day = mapCalendarDayView({
      date: "2026-03-31",
      timezone: "America/Los_Angeles",
      events: [
        {
          id: "evt-1",
          summary: "Late UTC event",
          start: "2026-04-01T00:30:00.000Z",
          end: "2026-04-01T01:00:00.000Z",
        },
        {
          id: "evt-2",
          summary: "Next local day",
          start: "2026-04-01T08:00:00.000Z",
          end: "2026-04-01T09:00:00.000Z",
        },
      ],
    });

    expect(day.items.map((event) => event.eventId)).toEqual(["evt-1"]);
  });
});
