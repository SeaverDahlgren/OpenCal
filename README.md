# openCal

OpenCal is a calendar and Gmail assistant with three runtimes:

1. a CLI
2. a local or hosted HTTP API
3. an Expo mobile app

The current product shape is a single-user private beta. Google OAuth and LLM provider keys stay on the backend.

## What OpenCal Does

OpenCal can read your calendar, find availability, create or update events, search Gmail, and draft emails. The assistant runs with explicit task state, clarification prompts, and confirmation steps for protected actions.

## Project Layout

`src/` contains the core agent, Google integrations, tools, memory, and shared runtime logic.

`apps/api` contains the HTTP API that wraps the core runtime.

`apps/mobile` contains the Expo app with Today, Calendar, Settings, and AI chat.

## Prerequisites

You need Node `>=20.11.0`, a Google Cloud project with Calendar and Gmail enabled, and at least one LLM API key for Gemini or Groq. If you want to run the mobile app, you also need Expo Go, an emulator, or the iOS Simulator.

## Environment Setup

Copy the example file first:

```bash
cp .env.example .env
```

Then fill in the Google OAuth values and one provider key:

```env
APP_ENV=development
API_VERSION=1.0.0
MIN_SUPPORTED_APP_VERSION=
STORAGE_BACKEND=file
JOB_BACKEND=file
DATABASE_URL=
REDIS_URL=
ADMIN_API_KEY=
STATE_ENCRYPTION_KEY=
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:42813/oauth/callback
GOOGLE_OAUTH_API_REDIRECT_URI=http://127.0.0.1:8787/api/v1/auth/google/callback

LLM_PROVIDER=groq
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile

# or
# LLM_PROVIDER=gemini
# GEMINI_API_KEY=...
# GEMINI_MODEL=gemini-2.5-flash

API_PORT=8787
SESSION_TTL_DAYS=14
TOOL_RESULT_VERBOSITY=compact
```

In `staging` or `production`, `STATE_ENCRYPTION_KEY` is required. The API uses it to encrypt persisted session and user-profile state under `.opencal/`.
Set `MIN_SUPPORTED_APP_VERSION` when you want the backend to reject stale mobile builds with `CLIENT_UPGRADE_REQUIRED`.
`STORAGE_BACKEND` and `JOB_BACKEND` currently default to `file`. `postgres` and `redis` are now explicit config seams for the next production storage adapters. When you switch those backends on, `DATABASE_URL` and `REDIS_URL` become required.

## Google OAuth Setup

Create a `Web application` OAuth client in Google Cloud. Add both local redirect URIs:

```text
http://127.0.0.1:42813/oauth/callback
http://127.0.0.1:8787/api/v1/auth/google/callback
```

Use an `External` consent screen in testing mode and add your Google account as a test user.

If Google shows `redirect_uri_mismatch`, one of those URIs is missing or does not match your `.env`.

## Install

Install root dependencies:

```bash
npm install
```

Install mobile dependencies:

```bash
npm --prefix apps/mobile install
```

## Run Locally

### CLI

Start the CLI with:

```bash
npm run dev
```

Force a fresh OAuth flow with:

```bash
npm run dev -- auth
```

The CLI opens Google OAuth in a browser, receives the callback on `127.0.0.1:42813`, stores tokens locally, and then starts the assistant.

### API

Start the API with:

```bash
npm run api:dev
```

Process one queued background job with:

```bash
npm run api:worker
```

Run the worker continuously with:

```bash
npm run api:worker:watch
```

The API and worker now boot their storage layer through one runtime factory. In the current beta, that resolves to encrypted file-backed repositories and a file-backed job queue. The config already reserves `postgres` and `redis` as future production backends, so deployment config can move without changing route code.

By default it listens on:

```text
http://127.0.0.1:8787
```

Health probes:

```text
GET /api/v1/health/live
GET /api/v1/health/ready
```

`/api/v1/health/ready` now returns the active storage/job backends plus queued job counts. If any jobs are in the `exhausted` state, readiness is reported as `degraded`.

Optional support endpoint:

```text
GET /api/v1/admin/session
GET /api/v1/admin/session?sessionId=...
GET /api/v1/admin/session?email=...
POST /api/v1/admin/session/reset?sessionId=...
POST /api/v1/admin/session/reset?email=...
POST /api/v1/admin/session/revoke?sessionId=...
POST /api/v1/admin/session/revoke?email=...
GET /api/v1/admin/job
GET /api/v1/admin/job?jobId=...
GET /api/v1/admin/job?status=pending
GET /api/v1/admin/job?sessionId=...
POST /api/v1/admin/job/retry?jobId=...
```

Enable it by setting `ADMIN_API_KEY` and sending that value as `x-admin-key`. Responses are sanitized. Reset clears task/chat state while keeping the session record. Revoke deletes the session. Job endpoints let support inspect queued retries and requeue a stuck job immediately.

For `POST /api/v1/agent/turn`, send an `Idempotency-Key` header on mobile retries or reconnects. The API caches successful responses per session so duplicate confirms do not create duplicate events or drafts.
Retryable model failures on that route are also queued as background jobs for later worker replay.
Jobs that hit `JOB_MAX_ATTEMPTS` now move to an explicit `exhausted` terminal state so support can distinguish dead-letter work from pending retries.
Mobile clients also send app-version metadata, and the API records the last seen client build and platform on each session for support/debugging.

### Mobile App

Start Expo with:

```bash
npm run mobile:start
```

Or launch a platform directly:

```bash
npm --prefix apps/mobile run ios
npm --prefix apps/mobile run android
```

The mobile app defaults to:

```text
http://127.0.0.1:8787/api/v1
```

If you need another backend URL, override it:

```bash
EXPO_PUBLIC_API_BASE_URL=http://<host>:8787/api/v1 npm --prefix apps/mobile run ios
```

Use that when testing on a device or when the API is running somewhere else.

## Deploying the API for Remote Use

The repo does not ship production infrastructure, but the API runtime can be hosted behind HTTPS.

To do that, deploy `apps/api`, then update:

```env
GOOGLE_OAUTH_API_REDIRECT_URI=https://api.example.com/api/v1/auth/google/callback
EXPO_PUBLIC_API_BASE_URL=https://api.example.com/api/v1
```

Then add that hosted callback URL to the Google OAuth client.

The mobile flow stays the same: Google redirects to the backend callback, the backend creates the OpenCal session, and the backend redirects back into the app with the session token.

Mobile/API sessions expire after `SESSION_TTL_DAYS`. Expired bearer tokens are rejected and need a fresh auth/bootstrap flow. Persisted API session records no longer keep raw bearer tokens at rest; the store keeps a derived hash instead.

## How To Use OpenCal

### Signing In

Open the mobile app, tap `Sign in with Google`, complete the browser flow, and return to the app.

Signing out revokes the current backend session and then clears the local mobile token.

### Today

The Today screen shows your current schedule and AI insight card. Pull to refresh whenever you want the latest calendar state.

### Calendar

The Calendar screen lets you move between months, inspect day details, and jump back to the current day with the `Today` button in the header. Pull to refresh if events were changed through chat and you want the month dots and counts refreshed immediately.

### Settings

The Settings screen lets you edit your profile name, timezone, work hours, and personalized notes. Saving settings updates the API-side user profile store and mirrors the result into `USER.md` for compatibility. Advanced mode exposes provider, model, and verbosity settings. Sign out is always available at the bottom of the page.

### AI Chat

Use the floating AI button to open chat. From there you can ask OpenCal to schedule, reschedule, draft emails, or explain your day. Clarifications and confirmations happen inline in chat. Draft confirmations can expand to preview the full email body.

Confirmation prompts are UI-only. The chat history keeps the final acknowledgement such as `Confirmed...` or `Cancelled...`, not the confirmation question itself.

## Build and Test

Typecheck:

```bash
npm run typecheck
```

Build:

```bash
npm run build
```

Run tests:

```bash
npm test
```

## Common Commands

```bash
npm run dev
npm run dev -- auth
npm run api:dev
npm run mobile:start
npm --prefix apps/mobile run ios
npm --prefix apps/mobile run android
npm run typecheck
npm run build
npm test
```

## Debugging

Structured logs are written to:

```text
.opencal/logs/YYYY-MM-DD.log
```

Use them to inspect tool failures, task-state transitions, blocked prompts, confirmation flows, and Google/API runtime issues.

API errors include a request id when available so support/debugging can correlate a client-visible failure with backend logs.

## More Docs

- [docs/README.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/README.md)
- [docs/setup.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/setup.md)
- [docs/mobile.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/mobile.md)
- [docs/providers.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/providers.md)
- [docs/debugging.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/debugging.md)
