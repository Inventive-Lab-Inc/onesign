# Deploy OneSign — Reference

## Environment identifiers

| Resource | Value |
|----------|--------|
| GitHub repo | `Inventive-Lab-Technologies/onesign` |
| Vercel project | `onesign-tv` |
| Supabase project ref | `nlkjbfwhzzpebsunmzrw` |
| Supabase project name | `tv-sign` |
| MinIO public base (releases) | `https://storage.onesigntv.com/onesign-releases` |
| MinIO public base (media) | `https://storage.onesigntv.com/onesign-media` |
| Android package | `dev.signage.tv` |
| VPS host (default) | `194.164.91.252` — override via `ONESIGN_VPS_HOST` in env |

## Local deploy env

| File | Committed? | Purpose |
|------|------------|---------|
| `.cursor/deploy.local.env.example` | Yes | Template |
| `.cursor/deploy.local.env` | **No** (gitignored) | VPS SSH + MinIO deploy vars (primary) |
| `apps/web/.env.local` | **No** (gitignored) | Same `ONESIGN_VPS_*` + `S3_*` (fallback for deploy skill) |

Setup once:

```bash
cp .cursor/deploy.local.env.example .cursor/deploy.local.env
# Edit deploy.local.env with real VPS password or SSH key path
```

Agent must `source .cursor/deploy.local.env` before any SSH/scp/mc deploy commands.

## Vercel MCP workflow

```
list_teams
list_deployments(projectId=<onesign-tv project id>, teamId=<team id>)
get_deployment_build_logs(idOrUrl=<failed deployment>, teamId=<team id>, limit=100)
```

Project root for Vercel is `apps/web` (`vercel.json` sets monorepo install/build from repo root).

## Signing note

Release builds currently use the debug keystore at `~/.android/debug.keystore`. All fleet devices must have been installed with the **same** signing certificate for in-place OTA upgrades to work.

## Rollback

| Layer | Action |
|-------|--------|
| Web | Promote previous deployment in Vercel dashboard |
| Android OTA | Re-activate previous `app_releases` row (APK remains on MinIO) |
| Database | Avoid rolling back applied migrations in prod without a planned down migration |

## Common Vercel build failures

- TypeScript strict errors in `apps/web` (e.g. nullable fields in new dashboard code)
- Missing env vars in Vercel project settings (compare to `apps/web/.env.example`)
- Fix locally with `pnpm run build`, commit, push — do not redo OTA unless Android changed

## `app_releases` column reference

| Column | Example |
|--------|---------|
| `version_code` | `16` |
| `version_name` | `0.9.7` |
| `storage_path` | `android/16-onesign-tv-release.apk` |
| `sha256` | 64-char lowercase hex |
| `package_name` | `dev.signage.tv` |
| `is_active` | one `true` per package |

RPC `tv_check_app_update(p_version_code, p_package_name)` returns download metadata when a newer active build exists.

## Pre-release QA (Android)

From `apps/android/README.md`:

1. Pair TV with dashboard; image + video playback
2. Edit playlist on web; TV picks up changes
3. Admin playback pause → standby
4. Brief offline; confirm cache/recovery behavior
