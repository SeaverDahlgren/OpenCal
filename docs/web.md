---
summary: React web app layout, reviewer-facing auth flow, and hosted deployment notes.
read_when:
  - implementing or debugging the React reviewer app
  - deploying the hosted review build
  - wiring browser auth, CORS, or Vercel config
---

# Web Review App

## Layout

- `apps/web`
  Reviewer-facing React app built with Vite.
- `apps/web/src/api`
  Browser API client and DTO shapes.
- `apps/web/src/components`
  Sign-in, Today, Calendar, Settings, and AI chat panels.

## Commands

- `npm --prefix apps/web install`
  Installs the web app dependencies.
- `npm run web:start`
  Starts the local Vite dev server.
- `npm run web:build`
  Builds the production web bundle.

## Auth Model

- The web app uses the same backend-owned Google OAuth flow as mobile.
- Browser sign-in calls:
  - `POST /api/v1/auth/google/start`
- The `returnTo` value should be the web app origin, for example:
  - `https://opencal-demo.vercel.app`
- After Google OAuth, the backend redirects back to that origin with:
  - `sessionToken`
  - `sessionId`
  - or `errorCode` / `errorMessage`
- The web app stores the bearer token in `localStorage` for the review window and then strips the token from the URL.

## Hosted Setup

- Host the API on a long-running Node environment with persistent disk.
- Host the web app as a static bundle on Vercel.
- Backend env needs both:
  - `ALLOWED_RETURN_TO_PREFIXES=https://your-web-app-origin`
  - `ALLOWED_WEB_ORIGINS=https://your-web-app-origin`
- Browser requests use bearer auth, so the API must answer CORS preflights for the Vercel origin.

## Current Review Scope

- Sign in and sign out
- Today overview
- Calendar month/day browsing
- Settings updates
- AI chat with clarifications and confirmations
- Schedule refresh after event changes
