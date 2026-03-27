export function mapTodayOverview(args: {
  date: string;
  timezone: string;
  events: Array<{
    id: string;
    summary: string;
    start: string;
    end: string;
    location?: string;
    attendees?: Array<string | null | undefined>;
    calendarId?: string;
  }>;
}) {
  const visibleEvents = args.events.filter((event) => eventDateKey(event.start, args.timezone) === args.date);
  return {
    date: args.date,
    timezone: args.timezone,
    greeting: buildGreeting(),
    schedule: visibleEvents.map((event) => ({
      eventId: event.id,
      title: event.summary,
      start: event.start,
      end: event.end,
      timeLabel: formatTimeRange(event.start, event.end, args.timezone),
      location: event.location ?? null,
      attendeePreview: (event.attendees ?? []).filter(Boolean).slice(0, 3) as string[],
      calendarId: event.calendarId ?? "primary",
      kind: "event" as const,
    })),
    insight: null,
    stale: false,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function mapCalendarMonthView(args: {
  year: number;
  month: number;
  timezone: string;
  events: Array<{
    start: string;
  }>;
}) {
  const today = new Date();
  const currentMonth = new Date(Date.UTC(args.year, args.month - 1, 1));
  const eventCountByDate = new Map<string, number>();

  for (const event of args.events) {
    const dateKey = eventDateKey(event.start, args.timezone);
    eventCountByDate.set(dateKey, (eventCountByDate.get(dateKey) ?? 0) + 1);
  }

  const start = startOfCalendarGrid(currentMonth);
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const dateOnly = date.toISOString().slice(0, 10);
    const count = eventCountByDate.get(dateOnly) ?? 0;
    return {
      date: dateOnly,
      inMonth: date.getUTCMonth() === currentMonth.getUTCMonth(),
      isToday: dateOnly === today.toISOString().slice(0, 10),
      isSelected: false,
      eventCount: count,
      highlights: buildHighlights(count),
    };
  });

  return {
    year: args.year,
    month: args.month,
    monthLabel: new Date(Date.UTC(args.year, args.month - 1, 15, 12)).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: args.timezone,
    }),
    timezone: args.timezone,
    calendarId: "primary",
    days,
    stale: false,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function mapCalendarDayView(args: {
  date: string;
  timezone: string;
  events: Array<{
    id: string;
    summary: string;
    start: string;
    end: string;
    location?: string;
    attendees?: Array<string | null | undefined>;
    calendarId?: string;
  }>;
}) {
  const visibleEvents = args.events.filter((event) => eventDateKey(event.start, args.timezone) === args.date);
  return {
    date: args.date,
    dateLabel: new Date(`${args.date}T12:00:00Z`).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: args.timezone,
    }),
    timezone: args.timezone,
    calendarId: "primary",
    items: visibleEvents.map((event) => ({
      eventId: event.id,
      title: event.summary,
      start: event.start,
      end: event.end,
      timeLabel: formatTimeRange(event.start, event.end, args.timezone),
      description: "",
      location: event.location ?? "",
      attendees: (event.attendees ?? [])
        .filter(Boolean)
        .map((email) => ({ name: email as string, email: email as string })),
      calendarId: event.calendarId ?? "primary",
      canReschedule: true,
    })),
    stale: false,
    lastUpdatedAt: new Date().toISOString(),
  };
}

function buildGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) {
    return "Good Morning.";
  }
  if (hour < 18) {
    return "Good Afternoon.";
  }
  return "Good Evening.";
}

function formatTimeRange(start: string, end: string, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
  return `${formatter.format(new Date(start))} - ${formatter.format(new Date(end))}`;
}

function startOfCalendarGrid(date: Date) {
  const copy = new Date(date);
  const day = copy.getUTCDay();
  const offset = -day;
  copy.setUTCDate(copy.getUTCDate() + offset);
  return copy;
}

function buildHighlights(eventCount: number) {
  if (eventCount <= 0) {
    return [];
  }

  const tones = ["primary", "tertiary", "primary"];
  return Array.from({ length: Math.min(eventCount, 3) }, (_, index) => ({
    tone: tones[index] ?? "primary",
  }));
}

function eventDateKey(start: string, timezone: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    return start;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date(start))
    .reduce(
      (acc, part) => {
        if (part.type === "year" || part.type === "month" || part.type === "day") {
          acc[part.type] = part.value;
        }
        return acc;
      },
      { year: "0000", month: "01", day: "01" } as Record<"year" | "month" | "day", string>,
    );

  return `${parts.year}-${parts.month}-${parts.day}`;
}
