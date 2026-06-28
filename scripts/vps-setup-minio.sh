#!/usr/bin/env bash
# One-time MinIO + Caddy setup for OneSign storage on a FRESH, DEDICATED VPS.
# Run as root on the server:
#   scp scripts/vps-setup-minio.sh root@194.164.91.252:/root/
#   ssh root@194.164.91.252 'bash /root/vps-setup-minio.sh'
#
# After DNS A record storage.onesigntv.com → this VPS IP:
#   curl -sI https://storage.onesigntv.com/onesign-media/ | head -5
#
# The VPS is dedicated to OneSign: this installs the host MinIO service and a
# host systemd Caddy that owns :80/:443 and serves storage.onesigntv.com. To
# (re)install only the Caddy storage route on an existing box, use
# scripts/vps-add-s3-storage-host.sh instead.
#
# This script also creates the least-privilege MinIO app user `onesign-app`
# (scoped to onesign buckets) so the app never uses the MinIO root key.

set -euo pipefail

S3_HOST="${S3_HOST:-storage.onesigntv.com}"
MINIO_USER="${MINIO_ROOT_USER:-onesign-admin}"
MINIO_PASS="${MINIO_ROOT_PASSWORD:?Set MINIO_ROOT_PASSWORD}"
MEDIA_BUCKET="${S3_MEDIA_BUCKET:-onesign-media}"
RELEASES_BUCKET="${S3_RELEASES_BUCKET:-onesign-releases}"
MINIO_DATA="${MINIO_DATA:-/data/minio}"

echo "==> Installing dependencies"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl wget ca-certificates gnupg

echo "==> Installing MinIO server"
install -m 755 -d /usr/local/bin
if [[ ! -x /usr/local/bin/minio ]]; then
  curl -fsSL "https://dl.min.io/server/minio/release/linux-amd64/minio" -o /usr/local/bin/minio
  chmod +x /usr/local/bin/minio
fi

if [[ ! -x /usr/local/bin/mc ]]; then
  curl -fsSL "https://dl.min.io/client/mc/release/linux-amd64/mc" -o /usr/local/bin/mc
  chmod +x /usr/local/bin/mc
fi

id -u minio-user &>/dev/null || useradd -r -s /sbin/nologin minio-user
mkdir -p "${MINIO_DATA}"
chown -R minio-user:minio-user "${MINIO_DATA}"

cat > /etc/default/minio <<EOF
MINIO_ROOT_USER=${MINIO_USER}
MINIO_ROOT_PASSWORD=${MINIO_PASS}
MINIO_VOLUMES="${MINIO_DATA}"
MINIO_OPTS="--address 127.0.0.1:9000 --console-address 127.0.0.1:9001"
EOF
chmod 600 /etc/default/minio

cat > /etc/systemd/system/minio.service <<'EOF'
[Unit]
Description=MinIO Object Storage
Documentation=https://min.io/docs/minio/linux/index.html
After=network-online.target
Wants=network-online.target

[Service]
User=minio-user
Group=minio-user
EnvironmentFile=/etc/default/minio
ExecStart=/usr/local/bin/minio server $MINIO_OPTS $MINIO_VOLUMES
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable minio
systemctl restart minio

echo "==> Waiting for MinIO on :9000"
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:9000/minio/health/live >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -sf http://127.0.0.1:9000/minio/health/live >/dev/null

echo "==> Installing Caddy"
if ! command -v caddy &>/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -qq
  apt-get install -y -qq caddy
fi

CADDYFILE="/etc/caddy/Caddyfile"
if [[ ! -f "${CADDYFILE}" ]]; then
  mkdir -p /etc/caddy
  touch "${CADDYFILE}"
fi

if ! grep -q "${S3_HOST}" "${CADDYFILE}"; then
  cp "${CADDYFILE}" "${CADDYFILE}.bak.$(date +%Y%m%d%H%M%S)" 2>/dev/null || true
  cat >> "${CADDYFILE}" <<EOF

${S3_HOST} {
	reverse_proxy 127.0.0.1:9000 {
		header_up Host {host}
	}
}
EOF
  echo "Appended ${S3_HOST} to ${CADDYFILE}"
fi

caddy validate --config "${CADDYFILE}"
systemctl enable caddy
systemctl reload caddy || systemctl restart caddy

echo "==> Creating MinIO buckets"
mc alias set local http://127.0.0.1:9000 "${MINIO_USER}" "${MINIO_PASS}" --api S3v4
mc mb --ignore-existing "local/${MEDIA_BUCKET}"
mc mb --ignore-existing "local/${RELEASES_BUCKET}"
mc anonymous set download "local/${MEDIA_BUCKET}"
mc anonymous set download "local/${RELEASES_BUCKET}"

echo "==> Creating least-privilege app user 'onesign-app' (scoped to onesign buckets)"
ONESIGN_APP_USER="onesign-app"
ONESIGN_APP_SECRET="${ONESIGN_APP_SECRET:-$(openssl rand -hex 20)}"
cat > /tmp/onesign-app-policy.json <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:GetBucketLocation", "s3:ListAllMyBuckets"], "Resource": ["arn:aws:s3:::*"] },
    { "Effect": "Allow", "Action": ["s3:*"], "Resource": [
        "arn:aws:s3:::${MEDIA_BUCKET}", "arn:aws:s3:::${MEDIA_BUCKET}/*",
        "arn:aws:s3:::${RELEASES_BUCKET}", "arn:aws:s3:::${RELEASES_BUCKET}/*"
    ] }
  ]
}
JSON
mc admin policy create local onesign-app-policy /tmp/onesign-app-policy.json 2>/dev/null || \
  mc admin policy add local onesign-app-policy /tmp/onesign-app-policy.json
mc admin user add local "${ONESIGN_APP_USER}" "${ONESIGN_APP_SECRET}"
mc admin policy attach local onesign-app-policy --user "${ONESIGN_APP_USER}" 2>/dev/null || \
  mc admin policy set local onesign-app-policy user="${ONESIGN_APP_USER}"
rm -f /tmp/onesign-app-policy.json

echo ""
echo "  >>> Set these as OneSign S3 creds (Vercel + apps/web/.env.local):"
echo "      S3_ACCESS_KEY=${ONESIGN_APP_USER}"
echo "      S3_SECRET_KEY=${ONESIGN_APP_SECRET}"

echo ""
echo "Done."
echo "  MinIO:  systemctl status minio"
echo "  Caddy:  systemctl status caddy"
echo "  DNS:    ${S3_HOST} A → $(curl -4 -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
echo "  Test:   curl -sI https://${S3_HOST}/${MEDIA_BUCKET}/ | head -5"
echo "  URLs:"
echo "    https://${S3_HOST}/${MEDIA_BUCKET}/"
echo "    https://${S3_HOST}/${RELEASES_BUCKET}/"
