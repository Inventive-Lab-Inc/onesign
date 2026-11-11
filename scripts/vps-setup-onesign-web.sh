#!/usr/bin/env bash
# One-time (idempotent) OneSign web host setup on the VPS.
# Installs pnpm if needed, writes systemd unit + Caddy site for:
#   onesigntv.com / www / app / player → 127.0.0.1:3005
#
# Expects code at /var/www/onesign (use scripts/deploy-onesign-web-vps.sh).
# Run as root on the VPS, or via the deploy script's --setup flag.

set -euo pipefail

APP_ROOT="${ONESIGN_WEB_ROOT:-/var/www/onesign}"
WEB_DIR="${APP_ROOT}/apps/web"
PORT="${ONESIGN_WEB_PORT:-3005}"
SERVICE_NAME="onesign-web"
CADDY_SITE="/etc/caddy/conf.d/onesign-web.caddy"
UNIT_PATH="/etc/systemd/system/${SERVICE_NAME}.service"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

if ! command -v caddy >/dev/null 2>&1; then
  echo "Caddy is not installed. Run scripts/vps-setup-minio.sh first." >&2
  exit 1
fi

echo "==> Ensuring Node + pnpm"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required (v20+)." >&2
  exit 1
fi
if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable
  corepack prepare pnpm@9.15.4 --activate
fi

mkdir -p "$APP_ROOT" /etc/caddy/conf.d

echo "==> Writing ${UNIT_PATH}"
cat > "$UNIT_PATH" <<EOF
[Unit]
Description=OneSign TV Next.js web (marketing + app + player)
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=${WEB_DIR}
EnvironmentFile=-${WEB_DIR}/.env.production.local
Environment=NODE_ENV=production
Environment=ONESIGN_VPS=1
Environment=PORT=${PORT}
Environment=AUTH_URL=https://app.onesigntv.com
Environment=AUTH_TRUST_HOST=true
Environment=NODE_OPTIONS=--max-old-space-size=350
# Soft memory ceiling — shared VPS with Viable/Ukil/MinIO/Docker
MemoryHigh=400M
MemoryMax=450M
# Bind loopback only. Do NOT set HOSTNAME=127.0.0.1 — that breaks Auth redirects.
# Call next directly — `pnpm start -- -H ...` forwards a literal "--" and breaks next.
ExecStart=${WEB_DIR}/node_modules/.bin/next start -H 127.0.0.1 -p ${PORT}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "==> Writing ${CADDY_SITE}"
cat > "$CADDY_SITE" <<'CADDY'
# OneSign web — marketing + app + browser player (Next.js on 127.0.0.1:3005)
onesigntv.com, www.onesigntv.com, app.onesigntv.com, player.onesigntv.com {
	encode gzip zstd

	@nextStatic path /_next/static/*
	header @nextStatic Cache-Control "public, max-age=31536000, immutable"

	reverse_proxy 127.0.0.1:3005 {
		header_up Host {host}
		header_up X-Real-IP {remote_host}
		# Auth.js / Next need the public host (app listens on 127.0.0.1:3005).
		header_up X-Forwarded-Host {host}
		header_up X-Forwarded-Proto {scheme}
	}
}
CADDY

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"

echo "==> Validating Caddy config"
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy

if [[ -d "${WEB_DIR}/.next" ]]; then
  echo "==> Build present — restarting ${SERVICE_NAME}"
  systemctl restart "$SERVICE_NAME"
  systemctl --no-pager --full status "$SERVICE_NAME" | head -20
else
  echo "==> No ${WEB_DIR}/.next yet — run deploy-onesign-web-vps.sh before starting traffic."
  systemctl stop "$SERVICE_NAME" 2>/dev/null || true
fi

echo "==> Setup done. Port ${PORT}, root ${APP_ROOT}"
