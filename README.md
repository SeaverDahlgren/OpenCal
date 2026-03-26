# openCal

Calendar/Gmail agent with a CLI runtime, a thin HTTP API, and an Expo mobile app scaffold.

## Quick Start

1. Copy `.env.example` to `.env`
2. Fill Google OAuth and model API credentials
3. Optional: set `TOOL_RESULT_VERBOSITY=verbose` if you want full tool payloads kept in model-facing conversation state
4. Install deps with `npm install`
5. Run the CLI with `npm run dev` or the API with `npm run api:dev`

## Docs

- [docs/README.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/README.md)
- [docs/setup.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/setup.md)
- [docs/providers.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/providers.md)
- [docs/debugging.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/debugging.md)

## Commands

- `npm run dev` starts the interactive agent
- `npm run api:dev` starts the HTTP API on `API_PORT` or `8787`
- `npm run mobile:start` starts the Expo app from `apps/mobile`
- `npm run dev -- auth` refreshes Google OAuth
- `npm run build` compiles TypeScript
- `npm test` runs the test suite
