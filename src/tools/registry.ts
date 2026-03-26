import { z } from "zod";
import type { GoogleClients } from "../integrations/google/auth.js";
import { GoogleCalendarService } from "../integrations/google/calendar.js";
import { GoogleGmailService } from "../integrations/google/gmail.js";
import type { ToolDefinition } from "./types.js";

const calendarIdSchema = z.preprocess(
  (value) => {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (typeof value === "string" && value.trim() === "") {
      return undefined;
    }
    return value;
  },
  z.string().default("primary"),
);

export function buildToolRegistry(clients: GoogleClients) {
  const calendarService = new GoogleCalendarService(clients.calendar);
  const gmailService = new GoogleGmailService(clients.gmail);

  const tools = [
    defineTool({
      name: "get_current_time",
      description: "Get the current ISO timestamp, UTC offset, and day of week.",
      protected: false,
      inputSchema: z.object({}),
      inputShape: "{}",
      execute: async (_input, context) => {
        const now = new Date();
        return {
          ok: true,
          data: {
            iso: now.toISOString(),
            utcOffset: Intl.DateTimeFormat("en-US", {
              timeZone: context.timezone,
              timeZoneName: "shortOffset",
            })
              .formatToParts(now)
              .find((part) => part.type === "timeZoneName")?.value ?? "",
            dayOfWeek: now.toLocaleDateString("en-US", {
              weekday: "long",
              timeZone: context.timezone,
            }),
          },
          summary: "Current time resolved.",
        };
      },
    }),
    defineTool({
      name: "list_calendars",
      description: "List available Google calendars.",
      protected: false,
      inputSchema: z.object({}),
      inputShape: "{}",
      execute: async () => {
        const calendars = await calendarService.listCalendars();
        return {
          ok: true,
          data: calendars,
          summary: `Found ${calendars.length} calendars.`,
        };
      },
    }),
    defineTool({
      name: "search_events",
      description: "Search calendar events in a time range or by query, with optional broader regex matching.",
      protected: false,
      inputSchema: z.object({
        calendarId: calendarIdSchema,
        query: z.string().optional(),
        queryPatterns: z.array(z.string().min(1)).optional(),
        timeMin: z.string().optional(),
        timeMax: z.string().optional(),
        maxResults: z.number().int().min(1).max(25).default(10),
        expectSingle: z.boolean().default(false),
      }),
      inputShape:
        '{calendarId?: string, query?: string, queryPatterns?: string[], timeMin?: ISOString, timeMax?: ISOString, maxResults?: number, expectSingle?: boolean}',
      execute: async (input) => {
        const events = await calendarService.searchEvents(input);
        if (input.expectSingle && events.length > 1) {
          return {
            ok: false,
            error: "Multiple events matched the query.",
            ambiguous: {
              kind: "entity",
              prompt: "Multiple events matched. Select one.",
              candidates: events.map((event) => ({
                value: event.id,
                label: `${event.summary} (${event.start})`,
              })),
            },
          };
        }
        return {
          ok: true,
          data: events,
          summary: `Found ${events.length} events.`,
        };
      },
    }),
    defineTool({
      name: "get_event",
      description: "Fetch full details for a specific event ID.",
      protected: false,
      inputSchema: z.object({
        calendarId: calendarIdSchema,
        eventId: z.string().min(1),
      }),
      inputShape: '{calendarId?: string, eventId: string}',
      execute: async (input) => {
        const event = await calendarService.getEvent(input.calendarId, input.eventId);
        return {
          ok: true,
          data: event,
          summary: `Fetched event ${input.eventId}.`,
        };
      },
    }),
    defineTool({
      name: "find_free_busy",
      description: "Return busy blocks for one or more calendars.",
      protected: false,
      inputSchema: z.object({
        timeMin: z.string().min(1),
        timeMax: z.string().min(1),
        calendarIds: z.array(z.string().min(1)).min(1),
      }),
      inputShape: '{timeMin: ISOString, timeMax: ISOString, calendarIds: string[]}',
      execute: async (input) => {
        const busy = await calendarService.findFreeBusy(input);
        return {
          ok: true,
          data: busy,
          summary: `Resolved free/busy for ${busy.length} calendars.`,
        };
      },
    }),
    defineTool({
      name: "find_time_slots",
      description: "Find free windows of a given duration across calendars.",
      protected: false,
      inputSchema: z.object({
        timeMin: z.string().min(1),
        timeMax: z.string().min(1),
        calendarIds: z.array(z.string().min(1)).min(1),
        durationMinutes: z.number().int().positive(),
      }),
      inputShape:
        '{timeMin: ISOString, timeMax: ISOString, calendarIds: string[], durationMinutes: number}',
      execute: async (input) => {
        const slots = await calendarService.findTimeSlots(input);
        return {
          ok: true,
          data: slots,
          summary: `Found ${slots.length} free time slots.`,
        };
      },
    }),
    defineTool({
      name: "create_event",
      description: "Create a calendar event.",
      protected: true,
      inputSchema: z.object({
        calendarId: calendarIdSchema,
        summary: z.string().min(1),
        description: z.string().optional(),
        location: z.string().optional(),
        start: z.string().min(1),
        end: z.string().min(1),
        attendeeEmails: z.array(z.string().email()).optional(),
      }),
      inputShape:
        '{calendarId?: string, summary: string, description?: string, location?: string, start: ISOString, end: ISOString, attendeeEmails?: string[]}',
      execute: async (input) => {
        const event = await calendarService.createEvent(input);
        return {
          ok: true,
          data: event,
          summary: `Created event ${event.summary}.`,
        };
      },
    }),
    defineTool({
      name: "update_event",
      description: "Update a calendar event.",
      protected: true,
      inputSchema: z.object({
        calendarId: calendarIdSchema,
        eventId: z.string().min(1),
        summary: z.string().optional(),
        description: z.string().optional(),
        location: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
      }),
      inputShape:
        '{calendarId?: string, eventId: string, summary?: string, description?: string, location?: string, start?: ISOString, end?: ISOString}',
      execute: async (input) => {
        const event = await calendarService.updateEvent(input);
        return {
          ok: true,
          data: event,
          summary: `Updated event ${event.id}.`,
        };
      },
    }),
    defineTool({
      name: "delete_event",
      description: "Delete a calendar event.",
      protected: true,
      inputSchema: z.object({
        calendarId: calendarIdSchema,
        eventId: z.string().min(1),
      }),
      inputShape: '{calendarId?: string, eventId: string}',
      execute: async (input) => {
        const result = await calendarService.deleteEvent(input);
        return {
          ok: true,
          data: result,
          summary: `Deleted event ${input.eventId}.`,
        };
      },
    }),
    defineTool({
      name: "search_emails",
      description: "Search Gmail messages by query string.",
      protected: false,
      inputSchema: z.object({
        query: z.string().min(1),
        maxResults: z.number().int().min(1).max(20).default(10),
        expectSingle: z.boolean().default(false),
      }),
      inputShape: '{query: string, maxResults?: number, expectSingle?: boolean}',
      execute: async (input) => {
        const emails = await gmailService.searchEmails(input);
        if (input.expectSingle && emails.length > 1) {
          return {
            ok: false,
            error: "Multiple emails matched the query.",
            ambiguous: {
              kind: "entity",
              prompt: "Multiple emails matched. Select one.",
              candidates: emails.map((email) => ({
                value: email.id,
                label: `${email.subject} | ${email.from} | ${email.date}`,
              })),
            },
          };
        }
        return {
          ok: true,
          data: emails,
          summary: `Found ${emails.length} matching emails.`,
        };
      },
    }),
    defineTool({
      name: "list_threads",
      description: "List recent Gmail threads.",
      protected: false,
      inputSchema: z.object({
        maxResults: z.number().int().min(1).max(20).default(10),
      }),
      inputShape: '{maxResults?: number}',
      execute: async (input) => {
        const threads = await gmailService.listThreads(input.maxResults);
        return {
          ok: true,
          data: threads,
          summary: `Found ${threads.length} recent threads.`,
        };
      },
    }),
    defineTool({
      name: "get_thread_details",
      description: "Fetch the last 3-5 messages for a Gmail thread.",
      protected: false,
      inputSchema: z.object({
        threadId: z.string().min(1),
        maxMessages: z.number().int().min(1).max(5).default(5),
      }),
      inputShape: '{threadId: string, maxMessages?: number}',
      execute: async (input) => {
        const details = await gmailService.getThreadDetails(input.threadId, input.maxMessages);
        return {
          ok: true,
          data: details,
          summary: `Fetched ${details.length} messages from thread ${input.threadId}.`,
        };
      },
    }),
    defineTool({
      name: "write_draft",
      description: "Create a Gmail draft for later review.",
      protected: true,
      inputSchema: z.object({
        to: z.array(z.string().email()).min(1),
        subject: z.string().min(1),
        body: z.string().min(1),
        cc: z.array(z.string().email()).optional(),
        bcc: z.array(z.string().email()).optional(),
      }),
      inputShape: '{to: string[], subject: string, body: string, cc?: string[], bcc?: string[]}',
      execute: async (input) => {
        const draft = await gmailService.writeDraft(input);
        return {
          ok: true,
          data: draft,
          summary: `Created draft ${draft.id}.`,
        };
      },
    }),
    defineTool({
      name: "resolve_entities",
      description: "Ask the user to choose one entity from multiple candidates.",
      protected: false,
      inputSchema: z.object({
        prompt: z.string().min(1),
        candidates: z.array(
          z.object({
            label: z.string().min(1),
            value: z.string().min(1),
          }),
        ),
      }),
      inputShape: '{prompt: string, candidates: {label: string, value: string}[]}',
      execute: async (input) => {
        return {
          ok: false,
          error: "Entity resolution requires user input.",
          ambiguous: {
            kind: "entity",
            prompt: input.prompt,
            candidates: input.candidates,
          },
        };
      },
    }),
    defineTool({
      name: "clarify_time",
      description: "Ask the user to clarify an underspecified time.",
      protected: false,
      inputSchema: z.object({
        prompt: z.string().min(1),
        options: z.array(z.string().min(1)).min(1),
      }),
      inputShape: '{prompt: string, options: string[]}',
      execute: async (input) => {
        return {
          ok: false,
          error: "Time clarification requires user input.",
          ambiguous: {
            kind: "time",
            prompt: input.prompt,
            candidates: input.options.map((option) => ({ label: option, value: option })),
          },
        };
      },
    }),
  ];

  return new Map(tools.map((tool) => [tool.name, tool]));
}

export function renderToolsMarkdown(tools: Map<string, ToolDefinition<any, unknown>>) {
  const rows = [...tools.values()]
    .map(
      (tool) =>
        `- ${tool.name}${tool.protected ? " [protected]" : ""}: ${tool.description}\n  input: ${tool.promptShape.inputShape}`,
    )
    .join("\n");

  return ["# TOOLS", "", rows, ""].join("\n");
}

function defineTool<TInput extends z.ZodTypeAny, TResult>(args: {
  name: string;
  description: string;
  protected: boolean;
  inputSchema: TInput;
  inputShape: string;
  execute: ToolDefinition<TInput, TResult>["execute"];
}): ToolDefinition<TInput, TResult> {
  return {
    name: args.name,
    description: args.description,
    protected: args.protected,
    inputSchema: args.inputSchema,
    promptShape: {
      name: args.name,
      description: args.description,
      protected: args.protected,
      inputShape: args.inputShape,
    },
    execute: args.execute,
  };
}
