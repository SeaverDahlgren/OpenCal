---
id: calendar-query-expansion
summary: Expand calendar requests into stems, aliases, and broader search patterns before using literal event queries.
domains:
  - calendar
triggers:
  - "\\bhow many times\\b"
  - "\\bmeeting\\b"
  - "\\bpractice\\b"
  - "\\bclass\\b"
  - "\\bsession\\b"
  - "\\bcalendar\\b"
read_when:
  - converting user intent into search_events arguments
  - broadening event lookups beyond exact wording
examples:
  - "How many times am I swimming next month?"
  - "Find my workout classes this week."
---

# Calendar Query Expansion

Interpret the user concept before deciding on literal `search_events` arguments.

Rules:

- Start from the user concept, not the literal token string.
- Expand activity names into stems and likely title variants.
- Prefer a small set of useful variants over a long noisy list.
- Use `queryPatterns` when a broader search pattern is safer than one exact `query`.

Expansion examples:

- `swimming` -> `swim`, `swim practice`, `swim(?:ming)?`
- `workout` -> `workout`, `training`, `session`, `practice`
- `1:1` -> `1:1`, `one on one`, `1 on 1`

When counting or searching for categories of events, do not assume event titles are literal copies of the user phrase. Broaden first, then call `search_events`.
