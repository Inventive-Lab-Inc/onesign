# OneSign Console (Flutter) — production client app

Client-only iOS/Android console. **No admin portal.**

## Capabilities

- Email/password + Google Sign-In (via `/api/auth/mobile-google`)
- Workspace switcher + Realtime console sync
- Dashboard, Screens (pair / re-pair / tags / hours / playlists / screenshot request)
- Content (media upload/delete, playlists, item schedules)
- Groups, Websites, Schedule overview
- Account team invites + billing deep-link to web

## Configure

`apps/mobile/.env` (gitignored):

```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
APP_URL=https://app.onesigntv.com
MEDIA_BASE_URL=https://storage.onesigntv.com/onesign-media
GOOGLE_SERVER_CLIENT_ID=<same as AUTH_GOOGLE_ID web client>
GOOGLE_IOS_CLIENT_ID=<iOS OAuth client from Google Cloud, required for iOS Google>
```

### Google Cloud (required for Google Sign-In)

1. Use existing **Web** OAuth client as `GOOGLE_SERVER_CLIENT_ID`.
2. Create **Android** OAuth client with package `tv.onesign.onesign_console` + SHA-1.
3. Create **iOS** OAuth client; set `GOOGLE_IOS_CLIENT_ID` and add the reversed client ID URL scheme in Xcode/`Info.plist`.

## Run / release

```bash
cd apps/mobile
dart pub get
flutter run                # device / simulator
flutter build apk --release
flutter build ipa --release   # after signing setup in Xcode
```

Keep office VPN off when downloading packages.

## Production dependencies

- Web deploy must include Bearer auth on media/websites/account APIs and `POST /api/auth/mobile-google`.
- Supabase Realtime enabled for `public` tables (already used by web).
