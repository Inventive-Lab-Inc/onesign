/**
 * Sync active paid plan_templates to Stripe Products/Prices (USD).
 *
 * Usage (from apps/web with env loaded):
 *   npx tsx scripts/sync-stripe-catalog.ts
 */
import { getStripeClient } from "../lib/stripe/client";
import { syncStripeCatalog } from "../lib/stripe/sync-catalog";
import { getSupabaseAdminClient } from "../lib/supabase/admin";

async function main() {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    throw new Error("Set STRIPE_SECRET_KEY");
  }

  const admin = getSupabaseAdminClient();
  const stripe = getStripeClient();
  const results = await syncStripeCatalog(admin, stripe);

  if (results.length === 0) {
    console.log("No paid active plans found in plan_templates.");
    return;
  }

  for (const row of results) {
    console.log(
      `${row.planName}: product=${row.productId} monthly=${row.monthlyPriceId} annual=${row.annualPriceId ?? "n/a"}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
