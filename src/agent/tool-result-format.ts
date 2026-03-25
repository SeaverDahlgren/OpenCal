import type { ToolResult } from "../tools/types.js";

export type ToolResultVerbosity = "compact" | "verbose";

export function formatToolResultMessage(
  toolName: string,
  result: ToolResult<unknown>,
  verbosity: ToolResultVerbosity,
): string {
  if (!result.ok) {
    return `${toolName}: ${result.error}`;
  }

  if (verbosity === "verbose") {
    return `${toolName}: ${result.summary}\n${JSON.stringify(result.data, null, 2)}`;
  }

  return formatCompactToolResult(toolName, result.summary, result.data);
}

function formatCompactToolResult(toolName: string, summary: string, data: unknown) {
  switch (toolName) {
    case "get_current_time":
      return formatCurrentTime(toolName, summary, data);
    case "list_calendars":
      return formatCalendarList(toolName, summary, data);
    case "search_events":
      return formatEventList(toolName, summary, data);
    case "get_event":
    case "create_event":
    case "update_event":
      return formatEventDetail(toolName, summary, data);
    case "find_free_busy":
      return formatFreeBusy(toolName, summary, data);
    case "find_time_slots":
      return formatTimeSlots(toolName, summary, data);
    case "delete_event":
      return formatDeleteEvent(toolName, summary, data);
    case "search_emails":
      return formatEmailList(toolName, summary, data);
    case "list_threads":
      return formatThreadList(toolName, summary, data);
    case "get_thread_details":
      return formatThreadDetails(toolName, summary, data);
    case "write_draft":
      return formatDraft(toolName, summary, data);
    default:
      return `${toolName}: ${summary}`;
  }
}

function formatCurrentTime(toolName: string, summary: string, data: unknown) {
  const value = asRecord(data);
  return [
    `${toolName}: ${summary}`,
    `- iso: ${stringField(value, "iso")}`,
    `- utc_offset: ${stringField(value, "utcOffset")}`,
    `- day_of_week: ${stringField(value, "dayOfWeek")}`,
  ].join("\n");
}

function formatCalendarList(toolName: string, summary: string, data: unknown) {
  const calendars = asRecordArray(data).slice(0, 5);
  return [
    `${toolName}: ${summary}`,
    ...calendars.map(
      (calendar) =>
        `- ${stringField(calendar, "id")} | ${stringField(calendar, "summary")} | ${Boolean(calendar.primary) ? "primary" : "secondary"}`,
    ),
  ].join("\n");
}

function formatEventList(toolName: string, summary: string, data: unknown) {
  const events = asRecordArray(data);
  return [
    `${toolName}: ${summary}`,
    ...events.slice(0, 5).map(
      (event) =>
        `- ${stringField(event, "id")} | ${stringField(event, "summary")} | ${stringField(event, "start")}`,
    ),
    events.length > 5 ? `- ${events.length - 5} more events omitted` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatEventDetail(toolName: string, summary: string, data: unknown) {
  const event = asRecord(data);
  const attendees = arrayField(event, "attendees");
  return [
    `${toolName}: ${summary}`,
    `- id: ${stringField(event, "id")}`,
    `- calendar_id: ${stringField(event, "calendarId")}`,
    `- summary: ${stringField(event, "summary")}`,
    `- start: ${stringField(event, "start")}`,
    `- end: ${stringField(event, "end")}`,
    stringField(event, "location") ? `- location: ${stringField(event, "location")}` : "",
    attendees.length > 0 ? `- attendees: ${attendees.slice(0, 3).join(", ")}${attendees.length > 3 ? "..." : ""}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatFreeBusy(toolName: string, summary: string, data: unknown) {
  const groups = asRecordArray(data);
  const totalBusyBlocks = groups.reduce((count, group) => count + arrayField(group, "busy").length, 0);

  return [
    `${toolName}: ${summary}`,
    `- calendars: ${groups.length}`,
    `- busy_blocks: ${totalBusyBlocks}`,
    ...groups.slice(0, 3).map((group) => {
      const busy = arrayField(group, "busy")
        .slice(0, 2)
        .map((window) => {
          const range = asRecord(window);
          return `${stringField(range, "start")} -> ${stringField(range, "end")}`;
        });
      return `- ${stringField(group, "calendarId")}: ${busy.join(", ") || "no busy blocks"}`;
    }),
  ].join("\n");
}

function formatTimeSlots(toolName: string, summary: string, data: unknown) {
  const slots = asRecordArray(data);
  return [
    `${toolName}: ${summary}`,
    ...slots.slice(0, 5).map(
      (slot) => `- ${stringField(slot, "start")} -> ${stringField(slot, "end")}`,
    ),
    slots.length > 5 ? `- ${slots.length - 5} more slots omitted` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatDeleteEvent(toolName: string, summary: string, data: unknown) {
  const value = asRecord(data);
  return `${toolName}: ${summary}\n- event_id: ${stringField(value, "eventId")}`;
}

function formatEmailList(toolName: string, summary: string, data: unknown) {
  const emails = asRecordArray(data);
  return [
    `${toolName}: ${summary}`,
    ...emails.slice(0, 5).map(
      (email) =>
        `- ${stringField(email, "id")} | ${truncate(stringField(email, "subject"), 60)} | ${truncate(stringField(email, "from"), 40)}`,
    ),
    emails.length > 5 ? `- ${emails.length - 5} more emails omitted` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatThreadList(toolName: string, summary: string, data: unknown) {
  const threads = asRecordArray(data);
  return [
    `${toolName}: ${summary}`,
    ...threads.slice(0, 5).map(
      (thread) =>
        `- ${stringField(thread, "id")} | ${truncate(stringField(thread, "subject"), 60)} | messages=${numberField(thread, "messageCount")}`,
    ),
    threads.length > 5 ? `- ${threads.length - 5} more threads omitted` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatThreadDetails(toolName: string, summary: string, data: unknown) {
  const messages = asRecordArray(data);
  return [
    `${toolName}: ${summary}`,
    ...messages.slice(0, 5).map(
      (message) =>
        `- ${stringField(message, "id")} | ${truncate(stringField(message, "snippet"), 90)}`,
    ),
    messages.length > 5 ? `- ${messages.length - 5} more messages omitted` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatDraft(toolName: string, summary: string, data: unknown) {
  const draft = asRecord(data);
  const recipients = arrayField(draft, "to");
  return [
    `${toolName}: ${summary}`,
    `- draft_id: ${stringField(draft, "id")}`,
    `- message_id: ${stringField(draft, "messageId")}`,
    `- to: ${recipients.join(", ")}`,
    `- subject: ${stringField(draft, "subject")}`,
  ].join("\n");
}

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asRecordArray(value: unknown) {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function numberField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" ? value : 0;
}

function arrayField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
}
