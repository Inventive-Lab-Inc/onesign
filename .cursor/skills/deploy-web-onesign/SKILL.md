---
name: deploy-web-onesign
description: Fast deploy of OneSign web frontend changes only — preflight, push to main, deploy to VPS (onesign-web). Use when the user asks to deploy/ship/push web, dashboard, or frontend changes that do NOT touch apps/android or packages/database/migrations.
---

# Deploy Web (fast path)

Web-only release for `apps/web` on the **VPS** (`onesign-web` systemd, Caddy → `:3005`). No Android, no MinIO APK upload, no migrations.

For Android OTA, SQL migrations, or full releases, use the **deploy-onesign** skill instead.

---

## Guard — confirm scope first

Run `git status` / `git diff --name-only origin/main`. Only proceed here if changes are limited to:

- `apps/web/`
- `packages/types/`
- docs / config / deploy scripts that don't affect the APK or DB schema

If anything under `apps/android/` or `packages/database/migrations/` changed, **stop** and use **deploy-onesign**.

---

## Step 1 — Preflight

From `apps/web`:

```bash
pnpm run typecheck && pnpm test && pnpm run build
```

Fix all failures before pushing. Local `build` writes to `.next-local` (safe beside `next dev`).

---

## Step 2 — Push to main

```bash
git push origin main
```

Only create commits if the user explicitly asks. Commit any intended changes first, then push.

---

## Step 3 — Deploy to VPS

Load credentials (`.cursor/deploy.local.env` or `apps/web/.env.local`), then:

```bash
./scripts/deploy-onesign-web-vps.sh
```

First-time box setup only:

```bash
./scripts/deploy-onesign-web-vps.sh --setup
```

Confirm `onesign-web` is **active** and Host-header curls return 200/307 on `127.0.0.1:3005`.

---

## Step 4 — Smoke test

Open production and check: login, devices, playlists, and the changed area (`https://app.onesigntv.com`, `https://onesigntv.com`).

---

## Checklist

```
Deploy Web

- [ ] Scope confirmed web-only (no android/, no migrations/)
- [ ] Preflight: typecheck + test + build pass
- [ ] Pushed to main
- [ ] ./scripts/deploy-onesign-web-vps.sh succeeded
- [ ] Production smoke test
```
