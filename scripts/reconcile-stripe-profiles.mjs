#!/usr/bin/env node
/**
 * Reconcile profiles.subscription_* fields against Stripe (test or live).
 *
 * For each profile with a stripe_customer_id and/or stripe_subscription_id:
 * - If Stripe has a live sub (active/trialing/past_due) → apply via RPC
 * - Else → revoke_stripe_subscription (preserves manual/staff/custom entitlements)
 *
 * Usage (from repo root):
 *   node scripts/reconcile-stripe-profiles.mjs
 *   node scripts/reconcile-stripe-profiles.mjs --dry-run
 *
 * Requires apps/web/.env.local: STRIPE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webEnv = join(__dirname, "../apps/web/.env.local");
const dryRun = process.argv.includes("--dry-run");

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
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key || !url || !service) {
  console.error("Need STRIPE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const stripe = new Stripe(key);
const admin = createClient(url, service, { auth: { persistSession: false } });
const LIVE = new Set(["active", "trialing", "past_due"]);
const keyMode = key.startsWith("sk_live") ? "live" : key.startsWith("sk_test") ? "test" : "unknown";

async function findLiveSub(customerId, knownId) {
  if (knownId) {
    try {
      const sub = await stripe.subscriptions.retrieve(knownId);
      if (LIVE.has(sub.status)) return sub;
    } catch {
      // missing / deleted
    }
  }
  if (!customerId) return null;
  const list = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
  });
  return (
    list.data
      .filter((s) => LIVE.has(s.status))
      .sort((a, b) => b.created - a.created)[0] ?? null
  );
}

async function main() {
  const { data: profiles, error } = await admin
    .from("profiles")
    .select(
      "id,client_name,stripe_customer_id,stripe_subscription_id,subscription_status,plan_kind",
    )
    .or("stripe_customer_id.not.is.null,stripe_subscription_id.not.is.null,subscription_status.not.is.null");

  if (error) throw error;

  const results = [];
  for (const profile of profiles ?? []) {
    const customerId = profile.stripe_customer_id?.trim() || null;
    const knownSub = profile.stripe_subscription_id?.trim() || null;
    let live = null;
    let stripeError = null;
    try {
      live = await findLiveSub(customerId, knownSub);
    } catch (err) {
      stripeError = err instanceof Error ? err.message : String(err);
    }

    const row = {
      id: profile.id,
      name: profile.client_name,
      dbStatus: profile.subscription_status,
      stripeLive: live?.id ?? null,
      stripeStatus: live?.status ?? null,
      action: "noop",
      stripeError,
    };

    if (stripeError) {
      row.action = "error";
      results.push(row);
      continue;
    }

    if (live) {
      const needsApply =
        profile.stripe_subscription_id !== live.id ||
        profile.subscription_status !== live.status;
      if (needsApply) {
        row.action = dryRun ? "would_apply" : "apply";
        if (!dryRun) {
          const planTemplateId = live.metadata?.plan_template_id?.trim();
          if (!planTemplateId) {
            row.action = "skip_missing_plan_template_id";
          } else {
            const { error: applyErr } = await admin.rpc("apply_stripe_subscription", {
              p_user_id: profile.id,
              p_stripe_customer_id: customerId,
              p_stripe_subscription_id: live.id,
              p_subscription_status: live.status,
              p_plan_template_id: planTemplateId,
            });
            if (applyErr) {
              row.action = "apply_error";
              row.stripeError = applyErr.message;
            }
          }
        }
      }
    } else if (
      profile.stripe_subscription_id ||
      (profile.subscription_status &&
        profile.subscription_status !== "canceled" &&
        profile.subscription_status !== "none")
    ) {
      row.action = dryRun ? "would_revoke" : "revoke";
      if (!dryRun) {
        const { error: revokeErr } = await admin.rpc("revoke_stripe_subscription", {
          p_user_id: profile.id,
        });
        if (revokeErr) {
          row.action = "revoke_error";
          row.stripeError = revokeErr.message;
        }
      }
    }

    results.push(row);
  }

  const summary = {
    keyMode,
    dryRun,
    counts: results.reduce((acc, r) => {
      acc[r.action] = (acc[r.action] ?? 0) + 1;
      return acc;
    }, {}),
    results: results.filter((r) => r.action !== "noop"),
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
