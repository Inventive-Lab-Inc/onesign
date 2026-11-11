#!/usr/bin/env bash
# Verify OneSign public DNS points at the VPS (post-cutover check).
# Expected A: 194.164.91.252 (override with ONESIGN_VPS_HOST if needed).

set -euo pipefail

EXPECT="${ONESIGN_VPS_HOST:-194.164.91.252}"
# If host is a hostname, resolve it once for comparison.
if [[ ! "$EXPECT" =~ ^[0-9.]+$ ]]; then
  EXPECT="$(dig +short "$EXPECT" A | head -1)"
fi

ok=0
fail=0

check_a() {
  local name="$1"
  local got
  got="$(dig +short "$name" A | head -1)"
  # Follow one CNAME hop
  if [[ -z "$got" || "$got" == *"." && "$got" != *[0-9]* ]]; then
    local cname
    cname="$(dig +short "$name" CNAME | head -1)"
    if [[ -n "$cname" ]]; then
      got="$(dig +short "$cname" A | head -1)"
    fi
  fi
  if [[ "$got" == "$EXPECT" ]]; then
    echo "OK   $name → $got"
    ok=$((ok + 1))
  else
    echo "WAIT $name → ${got:-none} (want $EXPECT)"
    fail=$((fail + 1))
  fi
}

check_a onesigntv.com
check_a www.onesigntv.com
check_a app.onesigntv.com
check_a player.onesigntv.com

echo "---"
if [[ "$fail" -eq 0 ]]; then
  echo "DNS cutover looks good. Checking HTTPS..."
  for url in https://onesigntv.com https://app.onesigntv.com https://player.onesigntv.com; do
    code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$url" || echo err)"
    echo "$url → HTTP $code"
  done
  exit 0
fi

echo "Update BigRock / mywhiteserver A records to $EXPECT, then re-run:"
echo "  ./scripts/verify-onesign-dns.sh"
exit 1
