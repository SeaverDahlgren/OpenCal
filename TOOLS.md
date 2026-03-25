# TOOLS

- get_current_time: Get the current ISO timestamp, UTC offset, and day of week.
  input: {}
- list_calendars: List available Google calendars.
  input: {}
- search_events: Search calendar events in a time range or by query.
  input: {calendarId?: string, query?: string, timeMin?: ISOString, timeMax?: ISOString, maxResults?: number, expectSingle?: boolean}
- get_event: Fetch full details for a specific event ID.
  input: {calendarId?: string, eventId: string}
- find_free_busy: Return busy blocks for one or more calendars.
  input: {timeMin: ISOString, timeMax: ISOString, calendarIds: string[]}
- find_time_slots: Find free windows of a given duration across calendars.
  input: {timeMin: ISOString, timeMax: ISOString, calendarIds: string[], durationMinutes: number}
- create_event [protected]: Create a calendar event.
  input: {calendarId?: string, summary: string, description?: string, location?: string, start: ISOString, end: ISOString, attendeeEmails?: string[]}
- update_event [protected]: Update a calendar event.
  input: {calendarId?: string, eventId: string, summary?: string, description?: string, location?: string, start?: ISOString, end?: ISOString}
- delete_event [protected]: Delete a calendar event.
  input: {calendarId?: string, eventId: string}
- search_emails: Search Gmail messages by query string.
  input: {query: string, maxResults?: number, expectSingle?: boolean}
- list_threads: List recent Gmail threads.
  input: {maxResults?: number}
- get_thread_details: Fetch the last 3-5 messages for a Gmail thread.
  input: {threadId: string, maxMessages?: number}
- write_draft [protected]: Create a Gmail draft for later review.
  input: {to: string[], subject: string, body: string, cc?: string[], bcc?: string[]}
- resolve_entities: Ask the user to choose one entity from multiple candidates.
  input: {prompt: string, candidates: {label: string, value: string}[]}
- clarify_time: Ask the user to clarify an underspecified time.
  input: {prompt: string, options: string[]}
