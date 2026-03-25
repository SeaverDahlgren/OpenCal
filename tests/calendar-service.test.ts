import { describe, expect, it } from "vitest";
import { GoogleCalendarService } from "../src/integrations/google/calendar.js";

describe("GoogleCalendarService.searchEvents", () => {
  it("returns the source calendarId with each event summary", async () => {
    const service = new GoogleCalendarService({
      events: {
        list: async () => ({
          data: {
            items: [
              {
                id: "evt-1",
                summary: "Weekly sync",
                start: { dateTime: "2026-03-25T10:00:00-07:00" },
                end: { dateTime: "2026-03-25T10:30:00-07:00" },
              },
            ],
          },
        }),
      },
    } as any);

    const events = await service.searchEvents({
      calendarId: "team-calendar@example.com",
      maxResults: 10,
    });

    expect(events).toEqual([
      {
        id: "evt-1",
        calendarId: "team-calendar@example.com",
        summary: "Weekly sync",
        status: "unknown",
        start: "2026-03-25T10:00:00-07:00",
        end: "2026-03-25T10:30:00-07:00",
        location: "",
        attendees: [],
      },
    ]);
  });
});
