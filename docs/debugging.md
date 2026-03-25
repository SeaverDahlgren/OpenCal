---
summary: Debug log locations, common failure modes, and practical commands for investigating runtime issues.
read_when:
  - debugging tool failures or agent loops
  - inspecting .opencal log output
  - investigating OAuth, provider, or calendar update issues
---

# Debugging

## Runtime Logs

Two log streams exist:

- `memory/YYYY-MM-DD.md`
  User and assistant transcript only.
- `.opencal/logs/YYYY-MM-DD.log`
  Structured JSON debug log for LLM decisions and tool execution.

## Debug Log Events

Common events in `.opencal/logs/*.log`:

- `turn.user_input`
- `llm.decision`
- `tool.start`
- `tool.confirmation`
- `tool.result`
- `tool.error`
- `tool.invalid_input`
- `turn.error`
- `turn.assistant_reply`

## Useful Commands

Tail the current debug log:

```bash
tail -f .opencal/logs/$(date +%F).log
```

Filter only tool failures:

```bash
rg '"event":"tool.error"|\"event\":\"tool.invalid_input\"' .opencal/logs/$(date +%F).log
```

Pretty-print JSON lines with `jq`:

```bash
jq -c . .opencal/logs/$(date +%F).log
```

## Common Failure Modes

### OAuth blocked

- app is not verified
- signed in as a non-test user
- redirect URI mismatch

### Provider failures

- transient model outage or rate limit
- invalid API key
- wrong `LLM_PROVIDER`

The runner now degrades these into user-facing fallback messages instead of crashing the REPL.

### Calendar update issues

If rescheduling/editing loops or stalls:

1. Inspect `search_events` output in the debug log.
2. Confirm the returned event includes the correct `id` and `calendarId`.
3. Check whether `get_event` / `update_event` received `calendarId: "primary"` or another value.
4. Look for `tool.invalid_input` or `tool.error` entries.
5. If the assistant says `Working through the tool results.`, inspect recent `llm.decision` entries to see whether the turn hit repeated tool calls without a final `stop`.

## What To Capture In A Bug Report

- user prompt
- relevant `.opencal/logs/*.log` lines
- relevant `memory/YYYY-MM-DD.md` excerpt
- provider name
- whether the target event was on `primary` or another calendar
