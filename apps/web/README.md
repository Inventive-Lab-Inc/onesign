# Web Dashboard

Next.js 14 (App Router) console for managing TVs, playlists, and uploads.

## Setup

```bash
pnpm install
cp .env.example .env.local
```

Fill `.env.local` with Supabase URL/anon key **and** MinIO settings (see `.env.example` for `NEXT_PUBLIC_MEDIA_BASE_URL`, `S3_*`). Apply SQL migrations from `packages/database/migrations` in the Supabase SQL editor.

Create MinIO buckets `onesign-media` and `onesign-releases` on your VPS (`scripts/init-onesign-minio-buckets.sh`).

Enable **Anonymous sign-ins** (Authentication → Providers) so the Android TV app can register devices without a service role key.

### Google sign-in (optional, direct — not via Supabase OAuth)

Console supports **Google (Auth.js)** and **email/password (Supabase)** during transition. Google login talks to Google directly; a server bridge then issues a Supabase session so playlists/media/devices keep working.

1. Apply migration `00032_auth_google_identities.sql` in the Supabase SQL editor.
2. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → **OAuth client ID** (Web application).
3. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://YOUR_PRODUCTION_DOMAIN/api/auth/callback/google`
4. Set in `.env.local` / Vercel:
   - `AUTH_SECRET` — `openssl rand -base64 32`
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — from Google Cloud
   - `SUPABASE_SERVICE_ROLE_KEY` — Dashboard → Settings → API (server-only)
   - `NEXT_PUBLIC_APP_URL` — public console URL in production
5. Email/password users can later sign in with Google using the same email; accounts are linked automatically.

## Develop

```bash
pnpm dev
```

## Stack notes

- Drag-and-drop uses [`@hello-pangea/dnd`](https://github.com/hello-pangea/dnd), the maintained fork compatible with React 18 (same API as `react-beautiful-dnd`).
- Sessions are handled with `@supabase/ssr` and `middleware.ts` so protected routes stay in sync with cookies.

## Deploy (Vercel)

Set `NEXT_PUBLIC_SUPABASE_*`, `NEXT_PUBLIC_MEDIA_BASE_URL`, `NEXT_PUBLIC_RELEASES_BASE_URL`, and server-only `S3_*` variables in the Vercel project settings.
