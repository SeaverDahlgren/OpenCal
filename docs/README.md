---
summary: Documentation index for setup, provider configuration, debugging, and the mobile/API architecture.
read_when:
  - starting repo work and looking for the right doc entrypoint
  - adding new docs pages or reorganizing documentation
---

# openCal Docs

## Files

- [setup.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/setup.md)
  Local install, `.env`, Google OAuth, and first-run flow.
- [providers.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/providers.md)
  Gemini and Groq adapter setup.
- [debugging.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/debugging.md)
  Runtime logs, task-state traces, and debugging steps for CLI and mobile/API flows.
- [mobile.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/mobile.md)
  Expo app and HTTP API layout, refactored module boundaries, and mobile/backend contract notes.
- [web.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/web.md)
  React reviewer app, browser auth flow, and hosted deploy notes.
- [../deploy/oracle/README.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/deploy/oracle/README.md)
  Oracle VM + Vercel review-window deployment runbook.
- [skills/README.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/skills/README.md)
  Planner-visible semantic skill manifests and their doc paths.

## Runtime Storage

- Hosted production state lives under `.opencal/`
  Sessions, profiles, durable memory, recommendations, jobs, and logs.
- `.opencal/cli/memory/YYYY-MM-DD.md`
  CLI-only daily user/assistant transcript.
- `.opencal/logs/YYYY-MM-DD.log`
  Structured debug log for hosted and CLI execution.

## Legacy CLI Prompt Files

- `.opencal/cli/SOUL.md`
  CLI/system behavior context.
- `.opencal/cli/USER.md`
  Legacy CLI user-context file.
- `.opencal/cli/TOOLS.md`
  CLI tool index generated from the runtime registry.
- `.opencal/cli/Memory.md`
  Legacy CLI long-term memory file.

Hosted mobile/web no longer use those markdown files as the source of truth for personalization or durable memory.
