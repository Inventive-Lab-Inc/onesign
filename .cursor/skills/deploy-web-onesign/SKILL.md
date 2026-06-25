---
name: deploy-web-onesign
description: Fast deploy of OneSign web frontend changes only — preflight, push to main, verify Vercel (onesign-tv) is READY. Use when the user asks to deploy/ship/push web, dashboard, or frontend changes that do NOT touch apps/android or packages/database/migrations.
---

# Deploy Web (fast path)

Web-only release for `apps/web` (Vercel project **onesign-tv**). No Android, no MinIO, no migrations.

For Android OTA, SQL migrations, or full releases, use the **deploy-onesign** skill instead.

---

## Guard — confirm scope first

Run `git status` / `git diff --name-only origin/main`. Only proceed here if changes are limited to:

- `apps/web/`
- `packages/types/`
- docs / config that don't affect the APK or DB schema

If anything under `apps/android/` or `packages/database/migrations/` changed, **stop** and use **deploy-onesign**.

---

## Step 1 — Preflight

From `apps/web`:

```bash
pnpm run typecheck && pnpm test && pnpm run build
```

Fix all failures before pushing. Local `build` catches most Vercel TypeScript errors.

---

## Step 2 — Push to main

Push to `main` auto-deploys **onesign-tv**.

```bash
git push origin main
```

Only create commits if the user explicitly asks. Commit any intended changes first, then push.

---

## Step 3 — Verify Vercel

Use **Vercel MCP** (`plugin-vercel-vercel`):

1. `list_teams` → team id
2. `list_deployments` for project **onesign-tv**
3. Confirm latest production deployment is **READY**
4. If **ERROR**: `get_deployment_build_logs` → fix → commit → push again

---

## Step 4 — Smoke test

Open production and check: login, devices, playlists, and the changed area.

---

## Checklist

```
Deploy Web

- [ ] Scope confirmed web-only (no android/, no migrations/)
- [ ] Preflight: typecheck + test + build pass
- [ ] Pushed to main
- [ ] Vercel onesign-tv production READY
- [ ] Production smoke test
```
