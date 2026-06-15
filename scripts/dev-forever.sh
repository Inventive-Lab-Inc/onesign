#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOG="$ROOT/.dev-server.log"
PIDFILE="$ROOT/.dev-server.pid"

echo $$ >"$PIDFILE"
echo "[$(date -Iseconds)] dev-forever supervisor started (pid $$)" >>"$LOG"

cleanup() {
  rm -f "$PIDFILE"
}
trap cleanup EXIT

while true; do
  echo "[$(date -Iseconds)] starting pnpm dev..." >>"$LOG"
  pnpm dev >>"$LOG" 2>&1 || true
  echo "[$(date -Iseconds)] pnpm dev stopped, restarting in 2s..." >>"$LOG"
  sleep 2
done
