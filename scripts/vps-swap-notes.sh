#!/usr/bin/env bash
# OneSign VPS (ONESIGN_VPS_*): swap pressure notes + safe mitigations.
# Does NOT restart services or prune other tenants' running containers.
#
# Observed (2026-11-07): ~3.8Gi RAM, swap ~1.7/2.0Gi used, disk OK (~29%).
# Swap fullness is MEMORY pressure, not disk — clearing /tmp alone won't fix it.
#
# Safe mitigations already used / re-runnable:
#   docker builder prune -f
#   journalctl --vacuum-size=500M
#   apt-get clean
#
# Optional later (ops review first — may remove unused images other apps rely on):
#   docker image prune -a   # unused images only; confirm with docker ps / compose first
#
# Structural fixes:
#   - Upgrade VPS RAM (best)
#   - Cap container memory limits in compose
#   - Move heavy services off this host
#
# Usage:
#   set -a && source apps/web/.env.local && set +a
#   ./scripts/vps-swap-notes.sh            # print status
#   ./scripts/vps-swap-notes.sh --clean    # safe prune + journal vacuum

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/apps/web/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/apps/web/.env.local"
  set +a
fi

: "${ONESIGN_VPS_HOST:?}"
: "${ONESIGN_VPS_USER:?}"

SSH=(ssh -o StrictHostKeyChecking=no)
if [[ -n "${ONESIGN_VPS_SSH_KEY_PATH:-}" && -f "${ONESIGN_VPS_SSH_KEY_PATH}" ]]; then
  SSH+=(-i "$ONESIGN_VPS_SSH_KEY_PATH")
elif [[ -n "${ONESIGN_VPS_PASSWORD:-}" ]] && command -v sshpass >/dev/null; then
  SSH=(sshpass -p "$ONESIGN_VPS_PASSWORD" "${SSH[@]}")
fi

REMOTE_STATUS='free -h; echo ---; swapon --show; echo ---; df -h /; echo ---; docker system df 2>/dev/null || true; echo ---; journalctl --disk-usage 2>/dev/null || true'
REMOTE_CLEAN='docker builder prune -f; journalctl --vacuum-size=500M; apt-get clean || true; free -h | grep -E "Mem|Swap"'

"${SSH[@]}" "${ONESIGN_VPS_USER}@${ONESIGN_VPS_HOST}" "$REMOTE_STATUS"
if [[ "${1:-}" == "--clean" ]]; then
  echo "=== safe clean ==="
  "${SSH[@]}" "${ONESIGN_VPS_USER}@${ONESIGN_VPS_HOST}" "$REMOTE_CLEAN"
fi
