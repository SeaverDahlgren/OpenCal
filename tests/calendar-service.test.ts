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

  it("falls back to broader token matching when the exact query misses", async () => {
    const calls: Array<{ q?: string }> = [];
    const service = new GoogleCalendarService({
      events: {
        list: async ({ q }: any) => {
          calls.push({ q });

          if (q === "swimming") {
            return { data: { items: [] } };
          }

          return {
            data: {
              items: [
                {
                  id: "evt-2",
                  summary: "Swim Practice",
                  description: "Pool session",
                  start: { dateTime: "2026-04-02T07:00:00-07:00" },
                  end: { dateTime: "2026-04-02T08:00:00-07:00" },
                },
              ],
            },
          };
        },
      },
    } as any);

    const events = await service.searchEvents({
      calendarId: "primary",
      query: "swimming",
      timeMin: "2026-04-01T00:00:00-07:00",
      timeMax: "2026-04-30T23:59:59-07:00",
      maxResults: 10,
    });

    expect(calls).toEqual([{ q: "swimming" }, { q: undefined }]);
    expect(events[0]?.summary).toBe("Swim Practice");
  });

  it("supports explicit regex query patterns for broader matching", async () => {
    const service = new GoogleCalendarService({
      events: {
        list: async ({ q }: any) => ({
          data: {
            items:
              q === "triathlon"
                ? []
                : [
                    {
                      id: "evt-3",
                      summary: "Swim Practice",
                      start: { dateTime: "2026-04-10T07:00:00-07:00" },
                      end: { dateTime: "2026-04-10T08:00:00-07:00" },
                    },
                  ],
          },
        }),
      },
    } as any);

    const events = await service.searchEvents({
      calendarId: "primary",
      query: "triathlon",
      queryPatterns: ["swim(?:ming)?|swim practice"],
      timeMin: "2026-04-01T00:00:00-07:00",
      timeMax: "2026-04-30T23:59:59-07:00",
      maxResults: 10,
    });

    expect(events[0]?.summary).toBe("Swim Practice");
  });
});
