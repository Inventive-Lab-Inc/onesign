#!/usr/bin/env bash
# Install / repair the OneSign storage edge (storage.onesigntv.com) on the VPS.
#
# The VPS is dedicated to OneSign. A host systemd Caddy owns :80/:443 and
# reverse-proxies storage.onesigntv.com to the host MinIO service
# (127.0.0.1:9000 for the S3 API, 127.0.0.1:9001 for the admin console).
#
# Idempotent. Run on the VPS as root after DNS points storage.onesigntv.com here:
#   scp scripts/vps-add-s3-storage-host.sh root@194.164.91.252:/root/
#   ssh root@194.164.91.252 'bash /root/vps-add-s3-storage-host.sh'

set -euo pipefail

HOST="storage.onesigntv.com"
CADDYFILE="/etc/caddy/Caddyfile"
ACME_EMAIL="${ACME_EMAIL:-admin@onesigntv.com}"

if ! command -v caddy >/dev/null 2>&1; then
  echo "Caddy is not installed on the host. Run scripts/vps-setup-minio.sh first." >&2
  exit 1
fi

mkdir -p /etc/caddy
[[ -f "$CADDYFILE" ]] && cp "$CADDYFILE" "${CADDYFILE}.bak.$(date +%Y%m%d%H%M%S)"

if grep -q "$HOST" "${CADDYFILE}" 2>/dev/null; then
  echo "Caddyfile already serves ${HOST}; leaving it in place."
else
  echo "==> Appending ${HOST} block to ${CADDYFILE}"
  # Ensure a global email directive exists (ACME contact).
  if ! grep -q "email " "${CADDYFILE}" 2>/dev/null; then
    printf '{\n\temail %s\n}\n\n' "${ACME_EMAIL}" | cat - "${CADDYFILE}" > "${CADDYFILE}.tmp" 2>/dev/null || \
      printf '{\n\temail %s\n}\n' "${ACME_EMAIL}" > "${CADDYFILE}.tmp"
    mv "${CADDYFILE}.tmp" "${CADDYFILE}"
  fi
  cat >> "${CADDYFILE}" <<CADDY

# OneSign object storage (MinIO media + APK releases) on the host.
${HOST} {
	@s3_signed header Authorization AWS4-HMAC-SHA256*
	@s3_presigned query X-Amz-Algorithm=AWS4-HMAC-SHA256
	@s3_objects path /onesign-media/* /onesign-releases/*

	handle @s3_signed {
		reverse_proxy 127.0.0.1:9000 {
			header_up Host {host}
		}
	}
	handle @s3_presigned {
		reverse_proxy 127.0.0.1:9000 {
			header_up Host {host}
		}
	}
	handle @s3_objects {
		reverse_proxy 127.0.0.1:9000 {
			header_up Host {host}
		}
	}
	handle {
		reverse_proxy 127.0.0.1:9001 {
			header_up Host {host}
		}
	}
}
CADDY
fi

echo "==> Validating Caddyfile"
caddy validate --config "${CADDYFILE}" --adapter caddyfile

echo "==> Enabling + (re)starting host Caddy"
systemctl enable caddy
systemctl reload caddy 2>/dev/null || systemctl restart caddy

echo ""
echo "Done. Verify (after DNS propagates + ACME issues a cert):"
echo "  curl -sS -o /dev/null -w 'HTTP %{http_code}\\n' https://${HOST}/minio/health/live"
