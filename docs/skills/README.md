---
summary: Semantic skill manifests used by the planner to generalize user intent before tool calls.
read_when:
  - adding or debugging semantic skill behavior
  - inspecting planner-visible skill guidance
  - changing semantic expansion or ambiguous time handling
---

# Skill Manifests

These markdown files are loaded by the runtime and exposed to the model in two layers:

- a short always-visible skill catalog with summary plus doc path
- full detailed skill text for the skills selected for the current turn

Current manifests:

- [calendar-query-expansion.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/skills/calendar-query-expansion.md)
- [email-query-expansion.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/skills/email-query-expansion.md)
- [ambiguous-time-handling.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/skills/ambiguous-time-handling.md)
