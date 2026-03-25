import type { calendar_v3 } from "googleapis";
import { findFreeWindows } from "../../tools/time.js";

export class GoogleCalendarService {
  constructor(private readonly client: calendar_v3.Calendar) {}

  async listCalendars() {
    const response = await this.client.calendarList.list();
    return (response.data.items ?? []).map((calendar) => ({
      id: calendar.id ?? "",
      summary: calendar.summary ?? "",
      primary: Boolean(calendar.primary),
      accessRole: calendar.accessRole ?? "unknown",
    }));
  }

  async searchEvents(args: {
    calendarId?: string;
    query?: string;
    timeMin?: string;
    timeMax?: string;
    maxResults: number;
  }) {
    const response = await this.client.events.list({
      calendarId: args.calendarId ?? "primary",
      q: args.query,
      timeMin: args.timeMin,
      timeMax: args.timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: args.maxResults,
    });

    return (response.data.items ?? []).map((event) => this.mapEventSummary(event));
  }

  async getEvent(calendarId: string, eventId: string) {
    const response = await this.client.events.get({
      calendarId,
      eventId,
    });
    return response.data;
  }

  async findFreeBusy(args: {
    timeMin: string;
    timeMax: string;
    calendarIds: string[];
  }) {
    const response = await this.client.freebusy.query({
      requestBody: {
        timeMin: args.timeMin,
        timeMax: args.timeMax,
        items: args.calendarIds.map((id) => ({ id })),
      },
    });

    const calendars = response.data.calendars ?? {};
    return Object.entries(calendars).map(([calendarId, info]) => ({
      calendarId,
      busy: (info.busy ?? []).map((window) => ({
        start: window.start ?? "",
        end: window.end ?? "",
      })),
    }));
  }

  async findTimeSlots(args: {
    timeMin: string;
    timeMax: string;
    calendarIds: string[];
    durationMinutes: number;
  }) {
    const busyGroups = await this.findFreeBusy(args);
    const busyWindows = busyGroups.flatMap((group) => group.busy);

    return findFreeWindows({
      rangeStart: args.timeMin,
      rangeEnd: args.timeMax,
      busyWindows,
      minDurationMinutes: args.durationMinutes,
    });
  }

  async createEvent(args: {
    calendarId?: string;
    summary: string;
    description?: string;
    location?: string;
    start: string;
    end: string;
    attendeeEmails?: string[];
  }) {
    const response = await this.client.events.insert({
      calendarId: args.calendarId ?? "primary",
      requestBody: {
        summary: args.summary,
        description: args.description,
        location: args.location,
        start: { dateTime: args.start },
        end: { dateTime: args.end },
        attendees: args.attendeeEmails?.map((email) => ({ email })),
      },
    });

    return this.mapEventSummary(response.data);
  }

  async updateEvent(args: {
    calendarId?: string;
    eventId: string;
    summary?: string;
    description?: string;
    location?: string;
    start?: string;
    end?: string;
  }) {
    const response = await this.client.events.patch({
      calendarId: args.calendarId ?? "primary",
      eventId: args.eventId,
      requestBody: {
        summary: args.summary,
        description: args.description,
        location: args.location,
        start: args.start ? { dateTime: args.start } : undefined,
        end: args.end ? { dateTime: args.end } : undefined,
      },
    });

    return this.mapEventSummary(response.data);
  }

  async deleteEvent(args: { calendarId?: string; eventId: string }) {
    await this.client.events.delete({
      calendarId: args.calendarId ?? "primary",
      eventId: args.eventId,
    });
    return { deleted: true, eventId: args.eventId };
  }

  private mapEventSummary(event: calendar_v3.Schema$Event) {
    return {
      id: event.id ?? "",
      summary: event.summary ?? "(untitled event)",
      status: event.status ?? "unknown",
      start: event.start?.dateTime ?? event.start?.date ?? "",
      end: event.end?.dateTime ?? event.end?.date ?? "",
      location: event.location ?? "",
      attendees:
        event.attendees?.map((attendee) => attendee.email).filter(Boolean) ?? [],
    };
  }
}
