#!/usr/bin/env node
/**
 * One-off / ops: ensure each Onesign Stripe customer has at most one live subscription.
 *
 * Usage (from apps/web):
 *   node ../../scripts/reconcile-stripe-subscriptions.mjs
 *
 * Requires STRIPE_SECRET_KEY in apps/web/.env.local (or env).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";

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

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is required");
  process.exit(1);
}

const stripe = new Stripe(key);
const LIVE = new Set(["active", "trialing", "past_due"]);

/** @param {Stripe.ApiList<Stripe.Subscription>} list */
function liveFrom(list) {
  return list.data
    .filter((s) => LIVE.has(s.status))
    .sort((a, b) => b.created - a.created);
}

async function reconcileCustomer(customerId, keepHint) {
  const list = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 30,
  });
  const live = liveFrom(list);
  if (live.length <= 1) {
    return { customerId, liveCount: live.length, canceled: [] };
  }

  const keep =
    (keepHint && live.find((s) => s.id === keepHint)) ||
    live.find((s) => s.metadata?.plan_template_id) ||
    live[0];

  const canceled = [];
  for (const sub of live) {
    if (sub.id === keep.id) continue;
    await stripe.subscriptions.cancel(sub.id);
    canceled.push(sub.id);
  }
  return { customerId, liveCount: live.length, keep: keep.id, canceled };
}

// Known Onesign customers from profiles (extend as needed / pipe from SQL).
const customers = [
  { id: "cus_UpcUPo3hRdB86o", keep: "sub_1TtDzJFfEjKLJ6ct0XeB9AEY" },
  { id: "cus_UpdSn8Sms7Snjc", keep: "sub_1TpyJXFfEjKLJ6cthsELNQoc" },
];

const results = [];
for (const c of customers) {
  results.push(await reconcileCustomer(c.id, c.keep));
}
console.log(JSON.stringify({ results }, null, 2));
