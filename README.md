# openCal

CLI Calendar/Gmail agent with Google OAuth, provider-agnostic LLM orchestration, protected action confirmation, ambiguity blocking, and local memory files.

## Quick Start

1. Copy `.env.example` to `.env`
2. Fill Google OAuth and model API credentials
3. Optional: set `TOOL_RESULT_VERBOSITY=verbose` if you want full tool payloads kept in model-facing conversation state
4. Install deps with `npm install`
5. Run `npm run dev`

## Docs

- [docs/README.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/README.md)
- [docs/setup.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/setup.md)
- [docs/providers.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/providers.md)
- [docs/debugging.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/debugging.md)

## Commands

- `npm run dev` starts the interactive agent
- `npm run dev -- auth` refreshes Google OAuth
- `npm run build` compiles TypeScript
- `npm test` runs the test suite
