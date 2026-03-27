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
   - `APP_ENV`
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - `GOOGLE_OAUTH_REDIRECT_URI`
   - `GOOGLE_OAUTH_API_REDIRECT_URI`
   - `SESSION_TTL_DAYS`
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
- Approve Google identity, Gmail, and Calendar scopes.
- The CLI waits for the callback on `127.0.0.1:42813`.
- Tokens are stored under secure storage when available, else encrypted under `.opencal/`.
- After workspace bootstrap, the CLI offers 4 optional personalization questions.
- Skipped answers are ignored.
- Work hours and meeting preferences are written into `USER.md`.
- Interests and broader assistant context are appended into `Memory.md`.
- Personalization setup completion is tracked in `.opencal/setup-state.json`.

## Auth Refresh

- Run `npm run dev -- auth` to force OAuth again after rotating credentials.
- Run `npm run dev -- auth` after scope changes too. Existing stored tokens will not pick up newly added scopes automatically.

## Mobile / API Auth

- Start the backend with `npm run api:dev`.
- The API exposes health probes for hosted environments:
  - `GET /api/v1/health/live`
  - `GET /api/v1/health/ready`
- If the machine already has reusable local Google auth, the mobile app will try `POST /api/v1/auth/google/reuse` before opening the browser.
- If that route returns `GOOGLE_AUTH_REQUIRED`, the app stays on the sign-in screen and you need a fresh Google OAuth flow.
- The mobile/API auth flow uses `GOOGLE_OAUTH_API_REDIRECT_URI`.
- Google should redirect to:
  - `http://127.0.0.1:8787/api/v1/auth/google/callback`
- The backend callback then creates the session and redirects back into Expo with `sessionToken` and `sessionId`.
- Mobile/API sessions now expire based on `SESSION_TTL_DAYS`. Expired bearer tokens are pruned on read and must be re-established through auth.

If the backend callback fails with an identity/authentication error after Google approval, the usual cause is that the stored token was granted before the app requested basic identity scopes. Re-run OAuth so Google grants the updated scope set.

If mobile sign-in lands on `connection refused`, the usual cause is that Google is still redirecting to the old CLI callback instead of the backend callback above.

## Notes

- Unverified Google apps in testing mode only work for configured test users.
- Public end-user Gmail access requires Google verification planning.
