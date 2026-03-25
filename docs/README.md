---
summary: Documentation index for setup, provider configuration, and debugging.
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
  Runtime logs, common failure modes, and debugging steps.
- [skills/README.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/skills/README.md)
  Planner-visible semantic skill manifests and their doc paths.

## Repo Runtime Files

- `SOUL.md`
  Assistant style and behavior.
- `USER.md`
  User preferences like timezone and working hours.
- `TOOLS.md`
  Tool index generated from the runtime registry.
- `Memory.md`
  Distilled long-term chat-derived memory.
- `memory/YYYY-MM-DD.md`
  Daily user/assistant transcript.
- `.opencal/logs/YYYY-MM-DD.log`
  Structured debug log for LLM and tool execution.
