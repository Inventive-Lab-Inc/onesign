#!/usr/bin/env node
/**
 * Live Stripe cutover checklist (does NOT invent live price IDs).
 *
 * Prints required env vars, webhook steps, and whether the current key is test/live.
 * After switching to sk_live_*:
 *   1) Update Vercel + apps/web/.env.local STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET /
 *      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
 *   2) Create webhook endpoint → https://app.onesigntv.com/api/stripe/webhook
 *      Events: checkout.session.completed, customer.subscription.*, invoice.paid,
 *      invoice.payment_failed (match apps/web/app/api/stripe/webhook/route.ts)
 *   3) From apps/web: npx tsx scripts/sync-stripe-catalog.ts
 *      (creates LIVE products/prices and writes IDs back to plan_templates)
 *   4) node scripts/reconcile-stripe-profiles.mjs --dry-run
 *      then without --dry-run once verified
 * 5) Smoke-test checkout on a real card in live mode
 *
 * Usage: node scripts/stripe-live-cutover-checklist.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webEnv = join(__dirname, "../apps/web/.env.local");

function loadEnv(path) {
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m || process.env[m[1]]) continue;
      let v = m[2].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  } catch {
    // optional
  }
}

loadEnv(webEnv);

const secret = process.env.STRIPE_SECRET_KEY ?? "";
const pub = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const wh = process.env.STRIPE_WEBHOOK_SECRET ?? "";

function mode(value, prefixLive, prefixTest) {
  if (value.startsWith(prefixLive)) return "live";
  if (value.startsWith(prefixTest)) return "test";
  return value ? "unknown" : "missing";
}

const report = {
  secretKeyMode: mode(secret, "sk_live_", "sk_test_"),
  publishableKeyMode: mode(pub, "pk_live_", "pk_test_"),
  webhookSecretPresent: Boolean(wh),
  readyForLiveCheckout: false,
  blockers: [],
  checklist: [
    "Put LIVE keys in Vercel Production + Preview (and local .env.local)",
    "Create LIVE webhook at https://app.onesigntv.com/api/stripe/webhook and set STRIPE_WEBHOOK_SECRET",
    "Run: cd apps/web && npx tsx scripts/sync-stripe-catalog.ts  (writes live price IDs to plan_templates)",
    "Run: node scripts/reconcile-stripe-profiles.mjs --dry-run then without --dry-run",
    "Confirm plan_templates.stripe_* IDs are livemode=true in Stripe Dashboard",
    "Do NOT reuse test price IDs (price_…) on live keys — they will 404",
  ],
};

if (report.secretKeyMode !== "live") {
  report.blockers.push("STRIPE_SECRET_KEY is not sk_live_* — cannot create live products from this machine");
}
if (report.publishableKeyMode !== "live") {
  report.blockers.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not pk_live_*");
}
if (!report.webhookSecretPresent) {
  report.blockers.push("STRIPE_WEBHOOK_SECRET missing");
}

report.readyForLiveCheckout = report.blockers.length === 0;

console.log(JSON.stringify(report, null, 2));
process.exit(report.readyForLiveCheckout ? 0 : 2);
