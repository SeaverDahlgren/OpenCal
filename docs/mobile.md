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

## Current Internal Boundaries

- `src/app/turn-engine-shared.ts`
  Shared turn-engine helpers used by both the CLI runner and the mobile session runtime.
- `src/agent/task-state.ts`
  Public task-state facade.
- `src/agent/task-state-*.ts`
  Internal task-state modules split by concern:
  - `task-state-types.ts`
  - `task-state-utils.ts`
  - `task-state-inference.ts`
  - `task-state-replies.ts`
  - `task-state-artifacts.ts`
- `apps/api/src/routes/utils.ts`
  Shared route-level helpers for timezone/session/task-state payload shaping.
- `apps/api/src/dto/calendar.ts`
  Today/month/day DTO mappers.
- `apps/api/src/dto/settings.ts`
  Settings DTO mappers from persisted user profile state.
- `apps/api/src/users/profile.ts`
  User profile shape plus legacy `USER.md` render/seed helpers.
- `apps/api/src/users/store.ts`
  Per-user persisted profile storage for API settings and timezone reads.
- `apps/api/src/storage/types.ts`
  Repository interfaces that let the API swap file-backed storage for database-backed adapters without changing route code.
- `apps/api/src/bootstrap/runtime.ts`
  Central runtime factory that resolves the active session/profile/token/idempotency/job backends from env config.
- `apps/api/src/jobs/store.ts`
  Persistent file-backed job queue for retryable API work.
- `apps/api/src/jobs/processor.ts`
  Worker-ready job processor that replays queued work such as retryable agent turns.
- `apps/api/src/dto/mappers.ts`
  Thin compatibility barrel that re-exports the DTO functions above.
- `apps/mobile/src/state/session.tsx`
  Session authority for bearer token, session bootstrap, task-state refresh, and agent actions.
- `apps/mobile/src/state/session-view.ts`
  Mobile UI view-model helpers for pending chat clarification/confirmation state.

## Commands

- `npm run api:dev`
  Starts the API server with `tsx apps/api/src/index.ts`.
- `npm run api:worker`
  Processes one queued background job and exits.
- `npm run api:worker:watch`
  Runs the worker in a polling loop for queued jobs.
- `npm run mobile:start`
  Runs `expo start` from `apps/mobile`.

## Auth Model

- Google OAuth remains backend-owned.
- The mobile app expects a backend-issued bearer token.
- The mobile app sends `x-opencal-app-version` on every API request.
- Sessions are resolved per user email and expire after the configured session TTL.
- Session and profile state can be encrypted at rest with `STATE_ENCRYPTION_KEY`.
- API Google credentials are now stored per user instead of one shared machine token.
- Signing out now revokes the current backend session before clearing the local mobile token.
- On cold start without a stored mobile bearer token, the session layer first tries `POST /api/v1/auth/google/reuse`.
- `auth/google/reuse` is a private-beta bootstrap path:
  - if local Google auth is still valid, the backend reuses or creates the current mobile session
  - if local Google auth is stale or missing, it returns `GOOGLE_AUTH_REQUIRED` and the app stays on the sign-in screen
- `auth/google/reuse` is development-only. In staging/production, the API returns `GOOGLE_AUTH_REQUIRED` and the app should go through the normal OAuth browser flow.
- The app includes an `auth-callback` route that can accept a `sessionToken` query param from your deep-link flow.
- `POST /api/v1/auth/google/start` accepts `returnTo`, and the backend callback redirects back to that deep link with `sessionToken` and `sessionId` query params when provided.
- The Google OAuth redirect used by the mobile/API path is:
  - `GOOGLE_OAUTH_API_REDIRECT_URI`
  - default: `http://127.0.0.1:8787/api/v1/auth/google/callback`

## Expo Runtime Notes

- Expo Go on SDK 53 expects Expo-aligned native navigation packages.
- The mobile app depends on:
  - `react-native-screens`
  - `react-native-safe-area-context`
  - `react-native-gesture-handler`
  - `react-native-reanimated`
- If the simulator shows `react-native-screens` prop-type crashes under Fabric/New Architecture, verify the installed versions match the Expo SDK instead of overriding `newArchEnabled`.

## Current Scope

- Today overview
- Calendar month/day views with month navigation and a header-level `Today` jump
- Settings with editable profile name, core preferences, and Advanced AI/session controls
- AI chat with inline clarification and confirmation cards

## State Ownership

- Backend session state is authoritative for:
  - conversation messages
  - active task state
  - pending clarification
  - pending confirmation
  - provider/model/verbosity selections
- Mobile session state is responsible for:
  - bearer token storage
  - session bootstrap and refresh
  - exposing a normalized pending chat turn to screens
- Chat screen should render state from the session layer, not reconstruct blocked-task state directly from raw API task payloads.

## API Notes

- Route modules are split under `apps/api/src/routes/`.
- Repeated route helpers now live in `apps/api/src/routes/utils.ts`.
- `POST /api/v1/agent/turn` supports `Idempotency-Key` for retry-safe mobile submits.
- Retryable LLM failures on `POST /api/v1/agent/turn` now enqueue an `agent_turn_retry` background job for worker processing.
- `STORAGE_BACKEND` and `JOB_BACKEND` now select the runtime repository layer. The current supported production path is still `file`, but the API no longer hardcodes file-backed stores at route startup.
- The API can enforce a minimum supported mobile build via `MIN_SUPPORTED_APP_VERSION`.
- DTO mapping is split by domain so adding Today/Calendar/Settings payload fields should happen in the matching DTO file, not in one growing catch-all mapper.
- Settings reads and writes per-user profile state from the API profile store.
- `USER.md` is now a legacy mirror/export path for compatibility, not the API source of truth.
- Health probes are available at:
  - `/api/v1/health/live`
  - `/api/v1/health/ready`
- When `ADMIN_API_KEY` is configured, support tooling can inspect sessions through:
  - `/api/v1/admin/session`
  - `/api/v1/admin/job`
- API error payloads now include request ids for support/debugging correlation.

## Notes

- Mobile code is scaffolded but not exercised in this repo’s Node test suite.
- Backend/API code is included in root TypeScript checks and build output.
