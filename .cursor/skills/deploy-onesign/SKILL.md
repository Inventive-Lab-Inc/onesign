---
name: deploy-onesign
description: Deploy OneSign digital-signage to production — GitHub push, Vercel web (onesign-tv), Supabase migrations/OTA, VPS MinIO APK hosting. Use when the user asks to release, deploy, ship to production, publish OTA, bump Android version, or push live.
---

# Deploy OneSign

Production stack for this monorepo:

| System | Role |
|--------|------|
| **GitHub** | Source of truth; push `main` triggers Vercel |
| **Vercel** | Web dashboard (`apps/web`, project **onesign-tv**) |
| **Supabase** | Postgres, RLS, TV RPCs, `app_releases` OTA metadata |
| **VPS MinIO** | Public APK + media at `https://s3.storage.inventivelab.bd` |

Repo: `https://github.com/aminul-inventivelab/onesign.git`

---

## Credentials (read before VPS / MinIO steps)

**At the start of every deploy**, load local secrets (gitignored):

1. Read `.cursor/deploy.local.env` (create from `.cursor/deploy.local.env.example` if missing).
2. Fallback: `apps/web/.env.local` — same `ONESIGN_VPS_*` and `S3_*` vars if the deploy file is absent.

Required for Android OTA upload via SSH:

| Variable | Purpose |
|----------|---------|
| `ONESIGN_VPS_HOST` | VPS IP or hostname |
| `ONESIGN_VPS_USER` | SSH user (usually `root`) |
| `ONESIGN_VPS_PASSWORD` | SSH password when using `sshpass` |
| `ONESIGN_VPS_SSH_KEY_PATH` | If set, use `ssh -i` instead of password |
| `ONESIGN_MINIO_MC_ALIAS` | `mc` alias on VPS (default `local`) |
| `ONESIGN_MINIO_RELEASES_BUCKET` | `onesign-releases` |

Load in shell before VPS commands (try deploy env first, then web env):

```bash
if [ -f .cursor/deploy.local.env ]; then
  set -a && source .cursor/deploy.local.env && set +a
elif [ -f apps/web/.env.local ]; then
  set -a && source apps/web/.env.local && set +a
fi
```

**Never commit** `.cursor/deploy.local.env`. Do not paste passwords into the skill, commits, or GitHub.

If the env file is missing, stop and tell the user to copy the example file and fill in values.

---

## Step 0 — Decide scope

Inspect `git diff` / changed paths:

| Changes | Do |
|---------|-----|
| **`apps/web/`**, `packages/types/`, docs only | **Web release** — GitHub + Vercel only |
| **`apps/android/`** (or Gradle config affecting the APK) | **Android OTA** — full TV path below |
| **`packages/database/migrations/`** | Apply Supabase migrations **before** code that depends on them |
| Web + Android | Migrations (if any) → preflight → Android build → GitHub → VPS + Supabase OTA → Vercel check |

**Do not release an APK if nothing under `apps/android/` changed.** Web-only = push GitHub and verify Vercel.

---

## Step 1 — Preflight (always)

```bash
# Web (run from apps/web)
pnpm run typecheck && pnpm test && pnpm run build

# Android (only if shipping TV app; from apps/android)
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
./gradlew :app:testDebugUnitTest :app:assembleRelease
```

Fix failures **before** pushing. Local `pnpm run build` catches most Vercel TypeScript errors.

---

## Step 2 — GitHub

1. Commit all intended changes on `main`.
2. Push: `git push origin main`
3. Optional but recommended for Android releases: create a **GitHub Release** tag (e.g. `android-tv-v0.9.7`), attach `app-release.apk`, note `versionCode` and SHA-256.

Only create commits when the user explicitly asks.

---

## Step 3 — Vercel (web)

Push to `main` auto-deploys **onesign-tv**.

Use **Vercel MCP** (`plugin-vercel-vercel`):

1. `list_teams` → get team id
2. `list_deployments` with project id for **onesign-tv**
3. Confirm latest production deployment state is **READY**
4. If **ERROR**: `get_deployment_build_logs` → fix web/TS issue → commit → push again

**Vercel failure does not require redoing Android OTA** unless Android code also changed in that fix.

Smoke-test production: login, devices, playlists, Settings → TV app updates (OTA) read-only view.

---

## Step 4 — Android OTA (only when `apps/android/` changed)

### 4a. Bump version (before building)

Edit `apps/android/app/build.gradle.kts`:

- `versionCode` — must increase every release (integer)
- `versionName` — e.g. `0.9.7`

`versionCode` must exceed the current active row in `app_releases`.

### 4b. Build release APK

```bash
cd apps/android
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
./gradlew :app:assembleRelease
```

Output: `apps/android/app/build/outputs/apk/release/app-release.apk`

```bash
shasum -a 256 apps/android/app/build/outputs/apk/release/app-release.apk
```

### 4c. Upload to VPS MinIO

Load credentials first: `set -a && source .cursor/deploy.local.env && set +a`

- Bucket: `$ONESIGN_MINIO_RELEASES_BUCKET` (default `onesign-releases`)
- Object path: `android/{versionCode}-onesign-tv-release.apk`  
  Example: `android/16-onesign-tv-release.apk`

**SSH + mc (default):**

```bash
APK="apps/android/app/build/outputs/apk/release/app-release.apk"
REMOTE="/tmp/{versionCode}-onesign-tv-release.apk"
OBJECT="android/{versionCode}-onesign-tv-release.apk"

if [ -n "$ONESIGN_VPS_SSH_KEY_PATH" ]; then
  scp -i "$ONESIGN_VPS_SSH_KEY_PATH" -o StrictHostKeyChecking=no "$APK" "${ONESIGN_VPS_USER}@${ONESIGN_VPS_HOST}:$REMOTE"
  ssh -i "$ONESIGN_VPS_SSH_KEY_PATH" -o StrictHostKeyChecking=no "${ONESIGN_VPS_USER}@${ONESIGN_VPS_HOST}" \
    "mc cp $REMOTE ${ONESIGN_MINIO_MC_ALIAS}/${ONESIGN_MINIO_RELEASES_BUCKET}/$OBJECT && mc stat ${ONESIGN_MINIO_MC_ALIAS}/${ONESIGN_MINIO_RELEASES_BUCKET}/$OBJECT && rm -f $REMOTE"
else
  sshpass -p "$ONESIGN_VPS_PASSWORD" scp -o StrictHostKeyChecking=no "$APK" "${ONESIGN_VPS_USER}@${ONESIGN_VPS_HOST}:$REMOTE"
  sshpass -p "$ONESIGN_VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "${ONESIGN_VPS_USER}@${ONESIGN_VPS_HOST}" \
    "mc cp $REMOTE ${ONESIGN_MINIO_MC_ALIAS}/${ONESIGN_MINIO_RELEASES_BUCKET}/$OBJECT && mc stat ${ONESIGN_MINIO_MC_ALIAS}/${ONESIGN_MINIO_RELEASES_BUCKET}/$OBJECT && rm -f $REMOTE"
fi
```

**Alternative:** upload via local S3 API using `S3_*` from `apps/web/.env.local` if SSH is unavailable.

Verify public URL:

```bash
curl -I "https://s3.storage.inventivelab.bd/onesign-releases/android/{versionCode}-onesign-tv-release.apk"
curl -s "https://s3.storage.inventivelab.bd/onesign-releases/android/{versionCode}-onesign-tv-release.apk" | shasum -a 256
```

### 4d. Supabase — insert and activate release

Use **Supabase MCP** (`user-supabase`), project ref **`nlkjbfwhzzpebsunmzrw`**.

Insert row (upsert on `version_code` + `package_name`):

```sql
INSERT INTO app_releases (version_code, version_name, storage_path, sha256, release_notes, is_active, package_name)
VALUES (
  {versionCode},
  '{versionName}',
  'android/{versionCode}-onesign-tv-release.apk',
  '{sha256_lowercase_hex}',
  '{release_notes}',
  false,
  'dev.signage.tv'
)
ON CONFLICT (version_code, package_name) DO UPDATE SET
  version_name = EXCLUDED.version_name,
  storage_path = EXCLUDED.storage_path,
  sha256 = EXCLUDED.sha256,
  release_notes = EXCLUDED.release_notes;
```

Activate (exactly one active build per package):

```sql
UPDATE app_releases SET is_active = false WHERE package_name = 'dev.signage.tv';
UPDATE app_releases SET is_active = true
WHERE package_name = 'dev.signage.tv' AND version_code = {versionCode};
```

Verify OTA RPC:

```sql
SELECT tv_check_app_update({previousVersionCode}, 'dev.signage.tv');
SELECT tv_check_app_update({versionCode}, 'dev.signage.tv');
```

First should return `updateAvailable: true`; second should return `false`.

TVs poll on cold start and ~every 6 hours. Dashboard **Settings → TV app updates (OTA)** is read-only.

---

## Step 5 — Supabase migrations (when SQL changed)

Apply new files in `packages/database/migrations/` in **filename order** via Supabase MCP `apply_migration` or `execute_sql` **before** deploying code that uses new schema/RPCs.

See [reference.md](reference.md) for migration notes.

---

## Quick decision tree

```
User wants production deploy
├─ Any packages/database/migrations/* changed?
│  └─ YES → Apply migrations in Supabase first
├─ Any apps/android/* changed?
│  ├─ NO  → Push GitHub → Check Vercel READY → done
│  └─ YES → Bump version → Build APK → Push GitHub
│           → Upload MinIO → Supabase app_releases + activate
│           → Check Vercel READY → verify OTA RPC + optional TV install
└─ Vercel ERROR?
   └─ Fix web build → Push again (skip APK/VPS/Supabase unless Android also changed)
```

---

## Checklist template

Copy and track when deploying:

```
Deploy OneSign — [web | android | full]

- [ ] Scope decided (android changes? migrations?)
- [ ] Preflight: web build (+ android tests if OTA)
- [ ] Supabase migrations applied (if any)
- [ ] versionCode/versionName bumped (android only)
- [ ] Release APK built + SHA-256 recorded (android only)
- [ ] GitHub: pushed to main (+ optional GitHub Release)
- [ ] Vercel: production READY
- [ ] Credentials: `.cursor/deploy.local.env` exists and sourced (android VPS steps)
- [ ] Supabase: app_releases row + activated (android only)
- [ ] tv_check_app_update verified (android only)
- [ ] Production smoke test
```

---

## Additional resources

- VPS/MinIO setup scripts: `scripts/vps-setup-minio.sh`, `scripts/init-onesign-minio-buckets.sh`
- Android OTA docs: `apps/android/README.md`
- Web/Vercel env vars: `apps/web/.env.example`, `apps/web/README.md`
- DB migrations: `packages/database/README.md`
- Detailed commands and rollback: [reference.md](reference.md)
