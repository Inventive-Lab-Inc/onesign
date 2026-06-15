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
  if pnpm dev >>"$LOG" 2>&1; then
    echo "[$(date -Iseconds)] pnpm dev exited cleanly" >>"$LOG"
    break
  fi
  echo "[$(date -Iseconds)] pnpm dev crashed, restarting in 2s..." >>"$LOG"
  sleep 2
done
