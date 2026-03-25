# openCal

CLI Calendar/Gmail agent with Google OAuth, provider-agnostic LLM orchestration, protected action confirmation, ambiguity blocking, and local memory files.

## Quick Start

1. Copy `.env.example` to `.env`
2. Fill Google OAuth and model API credentials
3. Install deps with `npm install`
4. Run `npm run dev`

## LLM Provider Setup

Set `LLM_PROVIDER` in `.env` to choose the active adapter.

- `gemini`
  - set `GEMINI_API_KEY`
  - optional model override via `GEMINI_MODEL`
- `groq`
  - set `GROQ_API_KEY`
  - optional model override via `GROQ_MODEL`

Example:

```env
LLM_PROVIDER=groq
GROQ_API_KEY=your-key
GROQ_MODEL=llama-3.3-70b-versatile
```

## Google OAuth Setup

1. Go to the Google Cloud Console and create or select a project.
2. Open `APIs & Services` -> `Enabled APIs & services`.
3. Enable these APIs:
   - `Google Calendar API`
   - `Gmail API`
4. Open `APIs & Services` -> `OAuth consent screen`.
5. Configure the app as `External` for personal testing, fill the app name/email fields, and add your Google account as a test user.
6. Open `APIs & Services` -> `Credentials` -> `Create Credentials` -> `OAuth client ID`.
7. Choose `Desktop app` if available. If you use `Web application`, add this redirect URI:
   - `http://127.0.0.1:42813/oauth/callback`
8. Copy the generated client ID and client secret into `.env`:
   - `GOOGLE_OAUTH_CLIENT_ID=...`
   - `GOOGLE_OAUTH_CLIENT_SECRET=...`
   - `GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:42813/oauth/callback`

Notes:
- The first `npm run dev` launch will print the OAuth URL and wait for the browser callback on the redirect URI above.
- If Google shows the app as unverified during local testing, use the configured test user account.
- If you regenerate the OAuth client, update `.env` and run `npm run dev auth` to force re-auth.

## Commands

- `npm run dev` starts the interactive agent
- `npm run dev auth` refreshes Google OAuth
- `npm run build` compiles TypeScript
- `npm test` runs the test suite
