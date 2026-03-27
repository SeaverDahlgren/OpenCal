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

By default it listens on:

```text
http://127.0.0.1:8787
```

Health probes:

```text
GET /api/v1/health/live
GET /api/v1/health/ready
```

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

Mobile/API sessions expire after `SESSION_TTL_DAYS`. Expired bearer tokens are rejected and need a fresh auth/bootstrap flow.

## How To Use OpenCal

### Signing In

Open the mobile app, tap `Sign in with Google`, complete the browser flow, and return to the app.

### Today

The Today screen shows your current schedule and AI insight card. Pull to refresh whenever you want the latest calendar state.

### Calendar

The Calendar screen lets you move between months, inspect day details, and jump back to the current day with the `Today` button in the header. Pull to refresh if events were changed through chat and you want the month dots and counts refreshed immediately.

### Settings

The Settings screen lets you edit your profile name, timezone, work hours, and personalized notes. Saving settings updates `USER.md`. Advanced mode exposes provider, model, and verbosity settings. Sign out is always available at the bottom of the page.

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

## More Docs

- [docs/README.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/README.md)
- [docs/setup.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/setup.md)
- [docs/mobile.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/mobile.md)
- [docs/providers.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/providers.md)
- [docs/debugging.md](/Users/seaverdahlgren/Desktop/Coding/agenticPrograms/openCal/docs/debugging.md)
