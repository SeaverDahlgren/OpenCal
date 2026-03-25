---
id: ambiguous-time-handling
summary: Resolve stable relative dates automatically, but force clarification for risky or underspecified time windows.
domains:
  - time
triggers:
  - "\\btoday\\b"
  - "\\btomorrow\\b"
  - "\\btonight\\b"
  - "\\bthis evening\\b"
  - "\\bnext week\\b"
  - "\\bnext month\\b"
  - "\\bmonday\\b"
  - "\\btuesday\\b"
  - "\\bwednesday\\b"
  - "\\bthursday\\b"
  - "\\bfriday\\b"
read_when:
  - interpreting relative dates or vague scheduling windows
  - deciding whether to call clarify_time
examples:
  - "How many times am I swimming next month?"
  - "Move my meeting to Friday afternoon."
---

# Ambiguous Time Handling

Rules:

- Safely resolve stable relative periods like `tomorrow`, `next week`, `next month` using the runtime date and timezone.
- Ask for clarification when the time window is vague enough to change the action result.
- For protected actions, bias toward clarification if the phrase leaves room for multiple valid times.

Clarify examples:

- `this evening`
- `Friday afternoon`
- `later`
- `sometime next week`

Safe auto-resolution examples:

- `tomorrow`
- `next month`
- `this Friday` when the calendar date is unambiguous in the current timezone
