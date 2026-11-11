#!/usr/bin/env bash
# Deploy OneSign web to the VPS (Caddy + systemd onesign-web on :3005).
#
# From repo root:
#   ./scripts/deploy-onesign-web-vps.sh           # sync + build + restart
#   ./scripts/deploy-onesign-web-vps.sh --setup   # also install unit/Caddy first
#
# Requires ONESIGN_VPS_* in .cursor/deploy.local.env or apps/web/.env.local.
# Copies production env from apps/web/.env.local (filtered) on each deploy.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SETUP=0
for arg in "$@"; do
  case "$arg" in
    --setup) SETUP=1 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
  esac
done

if [[ -f .cursor/deploy.local.env ]]; then
  set -a && source .cursor/deploy.local.env && set +a
elif [[ -f apps/web/.env.local ]]; then
  set -a && source apps/web/.env.local && set +a
fi

: "${ONESIGN_VPS_HOST:?Set ONESIGN_VPS_HOST}"
: "${ONESIGN_VPS_USER:?Set ONESIGN_VPS_USER}"

APP_ROOT="${ONESIGN_WEB_ROOT:-/var/www/onesign}"
WEB_DIR="${APP_ROOT}/apps/web"
REMOTE_ENV="${WEB_DIR}/.env.production.local"
LOCAL_ENV="${ROOT}/apps/web/.env.local"

SSH=(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=20)
SCP=(scp -o StrictHostKeyChecking=no)
RSYNC_SSH="ssh -o StrictHostKeyChecking=no -o ConnectTimeout=20"

if [[ -n "${ONESIGN_VPS_SSH_KEY_PATH:-}" && -f "${ONESIGN_VPS_SSH_KEY_PATH}" ]]; then
  SSH+=(-i "$ONESIGN_VPS_SSH_KEY_PATH")
  SCP+=(-i "$ONESIGN_VPS_SSH_KEY_PATH")
  RSYNC_SSH="ssh -i ${ONESIGN_VPS_SSH_KEY_PATH} -o StrictHostKeyChecking=no -o ConnectTimeout=20"
elif [[ -n "${ONESIGN_VPS_PASSWORD:-}" ]] && command -v sshpass >/dev/null; then
  SSH=(sshpass -p "$ONESIGN_VPS_PASSWORD" "${SSH[@]}")
  SCP=(sshpass -p "$ONESIGN_VPS_PASSWORD" "${SCP[@]}")
  RSYNC_SSH="sshpass -p ${ONESIGN_VPS_PASSWORD} ssh -o StrictHostKeyChecking=no -o ConnectTimeout=20"
fi

REMOTE="${ONESIGN_VPS_USER}@${ONESIGN_VPS_HOST}"

echo "==> Syncing monorepo → ${REMOTE}:${APP_ROOT}"
"${SSH[@]}" "$REMOTE" "mkdir -p '${APP_ROOT}'"

# Prefer rsync; fall back to tar-over-ssh if rsync missing locally.
if command -v rsync >/dev/null 2>&1; then
  rsync -az --delete \
    -e "$RSYNC_SSH" \
    --exclude '.git/' \
    --exclude 'node_modules/' \
    --exclude '**/node_modules/' \
    --exclude 'apps/web/.next/' \
    --exclude 'apps/web/.next-local/' \
    --exclude 'apps/web/.env.local' \
    --exclude 'apps/web/.env.production.local' \
    --exclude 'apps/android/' \
    --exclude 'apps/mobile/' \
    --exclude '.cursor/deploy.local.env' \
    --exclude '.DS_Store' \
    --exclude '**/.turbo/' \
    --exclude '**/tsconfig.tsbuildinfo' \
    "${ROOT}/" "${REMOTE}:${APP_ROOT}/"
else
  tar -C "$ROOT" \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='apps/web/.next' \
    --exclude='apps/web/.next-local' \
    --exclude='apps/web/.env.local' \
    --exclude='apps/android' \
    --exclude='apps/mobile' \
    --exclude='.cursor/deploy.local.env' \
    -czf - . | "${SSH[@]}" "$REMOTE" "mkdir -p '${APP_ROOT}' && tar -C '${APP_ROOT}' -xzf -"
fi

if [[ ! -f "$LOCAL_ENV" ]]; then
  echo "Missing ${LOCAL_ENV} — cannot write production env on VPS." >&2
  exit 1
fi

echo "==> Writing filtered production env → ${REMOTE_ENV}"
# Keep app secrets; drop local-only / VPS SSH credentials / insecure TLS flags.
FILTERED="$(mktemp)"
trap 'rm -f "$FILTERED"' EXIT
grep -E '^(NEXT_PUBLIC_|SUPABASE_|AUTH_|STRIPE_|S3_|AUTH_SECRET)' "$LOCAL_ENV" \
  | grep -vE '^(ONESIGN_VPS_|SUPABASE_INSECURE_TLS|DEV_INSECURE_TLS)=' \
  | grep -vE '^#' \
  > "$FILTERED" || true

# Force production public URLs (override any localhost from .env.local).
# AUTH_URL is required: Next listens on 127.0.0.1:3005, and without this
# Auth.js builds Google redirect_uri as https://localhost:3005/...
{
  echo ""
  echo "# Injected by deploy-onesign-web-vps.sh"
  echo "NEXT_PUBLIC_APP_URL=https://app.onesigntv.com"
  echo "NEXT_PUBLIC_MARKETING_URL=https://onesigntv.com"
  echo "NEXT_PUBLIC_PLAYER_URL=https://player.onesigntv.com"
  echo "AUTH_URL=https://app.onesigntv.com"
  echo "AUTH_TRUST_HOST=true"
  echo "ONESIGN_VPS=1"
} >> "$FILTERED"

# Deduplicate keys — last wins (so injected URLs override).
DEDUPED="$(mktemp)"
awk -F= '
  /^[[:space:]]*$/ { next }
  /^#/ { next }
  NF>=2 {
    key=$1
    val=substr($0, index($0,"=")+1)
    order[++n]=key
    vals[key]=val
  }
  END {
    seen[""]=0
    for (i=1;i<=n;i++) {
      k=order[i]
      if (!(k in seen)) {
        seen[k]=1
        keys[++m]=k
      } else {
        # refresh position: drop earlier, keep last
        for (j=1;j<=m;j++) if (keys[j]==k) { for (t=j;t<m;t++) keys[t]=keys[t+1]; m--; break }
        keys[++m]=k
      }
    }
    for (j=1;j<=m;j++) print keys[j] "=" vals[keys[j]]
  }
' "$FILTERED" > "$DEDUPED"
mv "$DEDUPED" "$FILTERED"

"${SCP[@]}" "$FILTERED" "${REMOTE}:${REMOTE_ENV}.tmp"
"${SSH[@]}" "$REMOTE" "mv '${REMOTE_ENV}.tmp' '${REMOTE_ENV}' && chmod 600 '${REMOTE_ENV}'"

if [[ "$SETUP" -eq 1 ]]; then
  echo "==> Running remote setup (systemd + Caddy)"
  "${SCP[@]}" "${ROOT}/scripts/vps-setup-onesign-web.sh" "${REMOTE}:/tmp/vps-setup-onesign-web.sh"
  "${SSH[@]}" "$REMOTE" "bash /tmp/vps-setup-onesign-web.sh"
fi

echo "==> Install + build on VPS (this can take a few minutes)"
"${SSH[@]}" "$REMOTE" bash -s <<REMOTE
set -euo pipefail
cd '${APP_ROOT}'
export ONESIGN_VPS=1
# Do NOT set NODE_ENV=production during install — pnpm would skip
# devDependencies (typescript, etc.) and Next cannot build.

if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable
  corepack prepare pnpm@9.15.4 --activate
fi

# Ensure systemd + Caddy exist even without --setup (idempotent).
if [[ ! -f /etc/systemd/system/onesign-web.service ]]; then
  bash '${APP_ROOT}/scripts/vps-setup-onesign-web.sh'
fi

# Clean any half-installed tree from a previous prod-only install.
rm -rf node_modules apps/web/node_modules packages/types/node_modules apps/web/.next

pnpm install --frozen-lockfile
pnpm --filter @signage/types build
cd apps/web && ONESIGN_VPS=1 pnpm run build && cd ../..

systemctl daemon-reload
systemctl enable onesign-web
systemctl restart onesign-web
sleep 3
systemctl --no-pager --full status onesign-web | head -25

# Local Host-header smoke (works before DNS cutover).
curl -sS -o /dev/null -w 'local_app_host HTTP %{http_code}\n' \
  -H 'Host: app.onesigntv.com' \
  "http://127.0.0.1:3005/" || true
curl -sS -o /dev/null -w 'local_marketing_host HTTP %{http_code}\n' \
  -H 'Host: onesigntv.com' \
  "http://127.0.0.1:3005/" || true
REMOTE

echo "==> Deploy complete → ${ONESIGN_VPS_HOST} (:3005)"
echo "    After DNS A records point here, https://onesigntv.com / app / player will serve from this VPS."
