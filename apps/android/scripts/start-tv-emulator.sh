#!/usr/bin/env bash
# Cold-boot the TV AVD with explicit DNS. Fixes "Starting…" hangs when the emulator
# can ping IPs but cannot resolve hostnames (e.g. *.supabase.co).
set -euo pipefail

ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
EMULATOR="$ANDROID_HOME/emulator/emulator"
AVD="${1:-TV_1}"

if [[ ! -x "$EMULATOR" ]]; then
  echo "Emulator not found at $EMULATOR. Set ANDROID_HOME or install Android SDK." >&2
  exit 1
fi

exec "$EMULATOR" -avd "$AVD" -dns-server 8.8.8.8,8.8.4.4 -no-snapshot-load
