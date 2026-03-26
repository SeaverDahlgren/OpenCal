---
summary: Expo mobile app and HTTP API layout, scripts, and integration notes.
read_when:
  - implementing or debugging the Expo app
  - running the API server for mobile clients
  - working on the mobile/backend contract
---

# Mobile + API

## Layout

- `apps/api`
  Thin HTTP API that wraps the existing backend core in `src/`.
- `apps/mobile`
  Expo app with Today, Calendar, Settings, and AI chat scaffolding.

## Commands

- `npm run api:dev`
  Starts the API server with `tsx apps/api/src/index.ts`.
- `npm run mobile:start`
  Runs `expo start` from `apps/mobile`.

## Auth Model

- Google OAuth remains backend-owned.
- The mobile app expects a backend-issued bearer token.
- The app includes an `auth-callback` route that can accept a `sessionToken` query param from your deep-link flow.

## Current Scope

- Today overview
- Calendar month/day views
- Settings with core preferences and Advanced AI/session controls
- AI chat with inline clarification and confirmation cards

## Notes

- Mobile code is scaffolded but not exercised in this repo’s Node test suite.
- Backend/API code is included in root TypeScript checks and build output.
