function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function summarizeConfirmationAction(
  toolName: string,
  input: Record<string, unknown>,
  timezone: string,
) {
  const summary = asString(input.summary);
  const subject = asString(input.subject);
  const title = summary || asString(input.title);
  const start = formatDateTime(asString(input.start), timezone);
  const end = formatDateTime(asString(input.end), timezone);
  const oldStart = formatDateTime(asString(input.oldStart) ?? asString(input.previousStart), timezone);
  const oldEnd = formatDateTime(asString(input.oldEnd) ?? asString(input.previousEnd), timezone);

  if (toolName === "write_draft") {
    return subject ? `create the draft "${subject}"` : "create this email draft";
  }

  if (toolName === "create_event") {
    if (title && start) {
      return `create "${title}" starting at ${start}`;
    }
    return title ? `create "${title}"` : "create this event";
  }

  if (toolName === "update_event") {
    const nextRange = formatRange(start, end);
    const priorRange = formatRange(oldStart, oldEnd);

    if (title && priorRange && nextRange) {
      return `move "${title}" from ${priorRange} to ${nextRange}`;
    }
    if (title && nextRange) {
      return `update "${title}" to ${nextRange}`;
    }
    if (title && end) {
      return `update "${title}" to end at ${end}`;
    }
    return title ? `update "${title}"` : "update this event";
  }

  if (toolName === "delete_event") {
    return title ? `delete "${title}"` : "delete this event";
  }

  if (title && start && end) {
    return `${toolName.replace(/_/g, " ")} "${title}" from ${start} to ${end}`;
  }

  if (title && start) {
    return `${toolName.replace(/_/g, " ")} "${title}" at ${start}`;
  }

  if (title || subject) {
    return `${toolName.replace(/_/g, " ")} ${JSON.stringify(title || subject)}`;
  }

  return toolName.replace(/_/g, " ");
}

export function formatConfirmationTime(value: unknown, timezone: string) {
  return formatDateTime(asString(value), timezone);
}

function formatDateTime(value: string | undefined, timezone: string) {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).formatToParts(date);

  const month = part(parts, "month");
  const day = part(parts, "day");
  const year = part(parts, "year");
  const hour = part(parts, "hour");
  const minute = part(parts, "minute");
  const dayPeriod = part(parts, "dayPeriod");
  const timeZoneName = part(parts, "timeZoneName");

  if (!month || !day || !year || !hour || !minute || !dayPeriod) {
    return value;
  }

  return `${month} ${day}, ${year} at ${hour}:${minute} ${dayPeriod}${timeZoneName ? ` ${timeZoneName}` : ""}`;
}

function formatRange(start: string | undefined, end: string | undefined) {
  if (start && end) {
    return `${start} - ${end}`;
  }
  return start ?? end;
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((entry) => entry.type === type)?.value;
}
