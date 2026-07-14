#!/usr/bin/env bash
# Finish Flutter platform scaffolding after macOS allows the Dart SDK.
# Run from Terminal.app:  ./scripts/bootstrap-mobile.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/mobile"

export PATH="/opt/homebrew/opt/openjdk@17/bin:/opt/homebrew/bin:$PATH"
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

echo "==> Flutter / Dart check (Gatekeeper must allow Dart)..."
flutter --version
dart --version

echo "==> Generating ios/ + android/ platform folders (keeps existing lib/)..."
flutter create --org tv.onesign --project-name onesign_console --platforms=ios,android .

echo "==> Fetching packages..."
flutter pub get

if [[ ! -f .env ]]; then
  if [[ -f ../web/.env.local ]]; then
    URL="$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' ../web/.env.local | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
    KEY="$(grep -E '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' ../web/.env.local | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
    cat > .env <<EOF
SUPABASE_URL=$URL
SUPABASE_ANON_KEY=$KEY
EOF
    echo "==> Wrote .env from apps/web/.env.local"
  else
    cp .env.example .env
    echo "==> Copied .env.example → .env (fill values)"
  fi
fi

if [[ -d "$ANDROID_HOME" ]]; then
  echo "sdk.dir=$ANDROID_HOME" > android/local.properties
fi

echo "==> flutter doctor..."
flutter doctor -v || true

echo ""
echo "Ready. Run:"
echo "  cd apps/mobile && flutter run"
echo ""
echo "If Dart was blocked: System Settings → Privacy & Security → Allow Anyway,"
echo "then re-run this script."
