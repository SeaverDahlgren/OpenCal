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

When `TOOL_RESULT_VERBOSITY=compact`, the agent still logs full raw tool payloads here even though model-facing tool messages are shortened.

## Runtime Structure To Know

When tracing a bug, these modules now own the main behavior:

- `src/app/turn-engine-shared.ts`
  Shared turn-engine helpers for both CLI and mobile/API flows.
- `src/agent/task-state.ts`
  Task-state public API.
- `src/agent/task-state-replies.ts`
  Blocked reply matching, option selection, and slot-choice parsing.
- `src/agent/task-state-inference.ts`
  Subgoal inference and task-summary merge behavior.
- `src/agent/task-state-artifacts.ts`
  Tool-result artifact shaping and subgoal completion rules.
- `apps/api/src/routes/utils.ts`
  Shared session/task-state response shaping for the API.
- `apps/mobile/src/state/session.tsx`
  Mobile session bootstrap, refresh, and agent action path.
- `apps/mobile/src/state/session-view.ts`
  Pending clarification/confirmation derivation used by chat.

## Debug Log Events

Common events in `.opencal/logs/*.log`:

- `turn.user_input`
- `task.created`
- `task.updated`
- `task.awaiting_user_response`
- `task.bound_followup`
- `task.completed`
- `task.replaced`
- `skill.catalog`
- `skill.selected`
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
5. Check the latest `task.*` entries to see which subgoals are still pending and whether the runner bound a terse follow-up like `yes` to the current task.
6. If the assistant says `Working through the tool results.`, inspect recent `llm.decision` entries to see whether the turn hit repeated tool calls without a final `stop`.

With the active-subgoal executor, the most useful fields inside `task.updated` entries are:
- `mode`
- `activeSubgoalId`
- active subgoal `status`
- active subgoal `artifacts`

If a blocked numeric reply is misbound or ignored, inspect:

1. `task.updated` for a blocked active subgoal with slot options
2. `task.bound_followup` for the numeric reply
3. `task.replaced` to confirm the runtime did not incorrectly start a new task

If mobile chat and backend task-state disagree, compare:

1. `GET /api/v1/agent/task-state` payload
2. `apps/mobile/src/state/session.tsx` refresh behavior
3. `apps/mobile/src/state/session-view.ts` pending-turn derivation

## What To Capture In A Bug Report

- user prompt
- relevant `.opencal/logs/*.log` lines
- relevant `memory/YYYY-MM-DD.md` excerpt
- provider name
- whether the target event was on `primary` or another calendar
