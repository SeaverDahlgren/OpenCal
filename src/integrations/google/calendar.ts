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
    queryPatterns?: string[];
    timeMin?: string;
    timeMax?: string;
    maxResults: number;
  }) {
    const calendarId = args.calendarId ?? "primary";
    const response = await this.client.events.list({
      calendarId,
      q: args.query,
      timeMin: args.timeMin,
      timeMax: args.timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: args.maxResults,
    });

    const initialItems = response.data.items ?? [];
    if (!args.query) {
      return initialItems.map((event) => this.mapEventSummary(event, calendarId));
    }

    const fallbackNeeded = initialItems.length < args.maxResults;
    const fallbackItems = fallbackNeeded
      ? await this.fetchBroadMatchCandidates({
          calendarId,
          timeMin: args.timeMin,
          timeMax: args.timeMax,
          maxResults: Math.min(Math.max(args.maxResults * 10, 50), 250),
        })
      : [];

    const broadMatches = fallbackItems.filter((event) =>
      matchesEventQuery(event, args.query ?? "", args.queryPatterns ?? []),
    );

    const combined = dedupeEventsById([...initialItems, ...broadMatches]).slice(0, args.maxResults);
    return combined.map((event) => this.mapEventSummary(event, calendarId));
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

  private mapEventSummary(event: calendar_v3.Schema$Event, calendarId?: string) {
    return {
      id: event.id ?? "",
      calendarId: calendarId ?? "",
      summary: event.summary ?? "(untitled event)",
      status: event.status ?? "unknown",
      start: event.start?.dateTime ?? event.start?.date ?? "",
      end: event.end?.dateTime ?? event.end?.date ?? "",
      location: event.location ?? "",
      attendees:
        event.attendees?.map((attendee) => attendee.email).filter(Boolean) ?? [],
    };
  }

  private async fetchBroadMatchCandidates(args: {
    calendarId: string;
    timeMin?: string;
    timeMax?: string;
    maxResults: number;
  }) {
    const response = await this.client.events.list({
      calendarId: args.calendarId,
      timeMin: args.timeMin,
      timeMax: args.timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: args.maxResults,
    });

    return response.data.items ?? [];
  }
}

function dedupeEventsById(events: calendar_v3.Schema$Event[]) {
  const seen = new Set<string>();
  const next: calendar_v3.Schema$Event[] = [];

  for (const event of events) {
    const id = event.id ?? "";
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    next.push(event);
  }

  return next;
}

function matchesEventQuery(
  event: calendar_v3.Schema$Event,
  query: string,
  queryPatterns: string[],
) {
  const haystack = [
    event.summary ?? "",
    event.description ?? "",
    event.location ?? "",
    ...(event.attendees?.map((attendee) => attendee.email ?? "") ?? []),
  ].join(" ");

  const regexes = buildBroadQueryRegexes(query, queryPatterns);
  return regexes.some((regex) => regex.test(haystack));
}

function buildBroadQueryRegexes(query: string, queryPatterns: string[]) {
  const regexes: RegExp[] = [];

  for (const pattern of queryPatterns) {
    try {
      regexes.push(new RegExp(pattern, "i"));
    } catch {
      // Ignore invalid regex input and continue with broader query fallbacks.
    }
  }

  const normalizedTokens = tokenize(query);
  for (const token of normalizedTokens) {
    const variants = new Set([token, stemToken(token)]);
    for (const variant of variants) {
      if (variant.length < 3) {
        continue;
      }
      regexes.push(new RegExp(`\\b${escapeRegex(variant)}\\w*\\b`, "i"));
    }
  }

  return regexes;
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((token) => token.length >= 3) ?? [];
}

function stemToken(token: string) {
  let stem = token.replace(/(ing|ers|er|ed|es|s)$/i, "");
  if (/([bcdfghjklmnpqrstvwxyz])\1$/i.test(stem)) {
    stem = stem.slice(0, -1);
  }
  return stem || token;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
