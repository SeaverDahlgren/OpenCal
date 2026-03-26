---
summary: Local setup, environment variables, Google OAuth, and first-run auth flow.
read_when:
  - configuring the project for the first time
  - troubleshooting Google OAuth setup
  - rotating local credentials
---

# Setup

## Local Prereqs

- Node `>=20.11.0`
- Google account for Calendar/Gmail access
- one LLM API key for the provider you want to use

## Install

1. Copy `.env.example` to `.env`
2. Fill:
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - `GOOGLE_OAUTH_REDIRECT_URI`
   - `GOOGLE_OAUTH_API_REDIRECT_URI`
   - provider API key such as `GEMINI_API_KEY` or `GROQ_API_KEY`
3. Run `npm install`
4. Run `npm run dev`

## Google OAuth

1. Open Google Cloud Console.
2. Create or select a project.
3. Enable:
   - `Google Calendar API`
   - `Gmail API`
4. Configure the OAuth consent screen.
5. For local testing:
   - use `External`
   - keep the app in testing
   - add your Google account as a test user
6. Create an OAuth client under `APIs & Services -> Credentials`.
7. Add these authorized redirect URIs:
   - CLI:
   - `http://127.0.0.1:42813/oauth/callback`
   - API / Expo mobile:
   - `http://127.0.0.1:8787/api/v1/auth/google/callback`
8. Copy the client ID and secret into `.env`.

## First Run

- The CLI prints an OAuth URL.
- Open it in the browser.
- Approve Gmail + Calendar scopes.
- The CLI waits for the callback on `127.0.0.1:42813`.
- Tokens are stored under secure storage when available, else encrypted under `.opencal/`.
- After workspace bootstrap, the CLI offers 4 optional personalization questions.
- Skipped answers are ignored.
- Work hours and meeting preferences are written into `USER.md`.
- Interests and broader assistant context are appended into `Memory.md`.
- Personalization setup completion is tracked in `.opencal/setup-state.json`.

## Auth Refresh

- Run `npm run dev -- auth` to force OAuth again after rotating credentials.

## Mobile / API Auth

- Start the backend with `npm run api:dev`.
- If the machine already has reusable local Google auth, the mobile app will try `POST /api/v1/auth/google/reuse` before opening the browser.
- If that route returns `GOOGLE_AUTH_REQUIRED`, the app stays on the sign-in screen and you need a fresh Google OAuth flow.
- The mobile/API auth flow uses `GOOGLE_OAUTH_API_REDIRECT_URI`.
- Google should redirect to:
  - `http://127.0.0.1:8787/api/v1/auth/google/callback`
- The backend callback then creates the session and redirects back into Expo with `sessionToken` and `sessionId`.

If mobile sign-in lands on `connection refused`, the usual cause is that Google is still redirecting to the old CLI callback instead of the backend callback above.

## Notes

- Unverified Google apps in testing mode only work for configured test users.
- Public end-user Gmail access requires Google verification planning.
