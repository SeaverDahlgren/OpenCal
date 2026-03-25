---
id: email-query-expansion
summary: Broaden Gmail searches into subject, sender, and semantic variants instead of relying on one literal phrase.
domains:
  - email
triggers:
  - "\\bemail\\b"
  - "\\bdraft\\b"
  - "\\bthread\\b"
  - "\\breply\\b"
  - "\\bsubject\\b"
  - "\\bsender\\b"
read_when:
  - converting a user request into search_emails or list_threads queries
  - dealing with approximate email wording
examples:
  - "Find the thread about the invoice."
  - "Search for the email where Sarah asked to reschedule."
---

# Email Query Expansion

Before calling Gmail search tools:

- Separate people, subject matter, and action words.
- Prefer broader query variants when the user is recalling meaning rather than quoting exact text.
- Use multiple plausible subject/body concepts instead of one brittle phrase.

Examples:

- `invoice reminder` may appear as `invoice`, `billing`, `payment reminder`
- `reschedule` may appear as `move`, `shift`, `change time`

Use broader semantic decomposition first, then produce the concrete Gmail tool query.
