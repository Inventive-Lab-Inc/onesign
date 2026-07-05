import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanTemplate } from "@signage/types";
import type Stripe from "stripe";
import { annualChargeCents, isPaidPlanTemplate } from "./plan-template";

export type StripeCatalogSyncResult = {
  planId: string;
  planName: string;
  productId: string;
  monthlyPriceId: string | null;
  annualPriceId: string | null;
};

async function loadPaidActivePlans(admin: SupabaseClient): Promise<PlanTemplate[]> {
  const { data, error } = await admin
    .from("plan_templates")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    throw new Error(error.message);
  }

  return ((data as PlanTemplate[]) ?? []).filter(isPaidPlanTemplate);
}

async function ensureStripeProduct(
  stripe: Stripe,
  plan: PlanTemplate,
): Promise<string> {
  const existing = plan.stripe_product_id?.trim();
  if (existing) {
    await stripe.products.update(existing, {
      name: `OneSign ${plan.name}`,
      description: plan.tagline || undefined,
      metadata: { plan_template_id: plan.id },
      active: true,
    });
    return existing;
  }

  const product = await stripe.products.create({
    name: `OneSign ${plan.name}`,
    description: plan.tagline || undefined,
    metadata: { plan_template_id: plan.id },
  });

  return product.id;
}

async function ensureStripePrice(
  stripe: Stripe,
  productId: string,
  planTemplateId: string,
  billingPeriod: "monthly" | "annual",
  unitAmountCents: number,
  existingPriceId: string | null | undefined,
): Promise<string> {
  const trimmed = existingPriceId?.trim();
  if (trimmed) {
    const price = await stripe.prices.retrieve(trimmed);
    if (
      price.active &&
      price.unit_amount === unitAmountCents &&
      price.recurring?.interval === (billingPeriod === "annual" ? "year" : "month")
    ) {
      return trimmed;
    }
  }

  const price = await stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: unitAmountCents,
    recurring: { interval: billingPeriod === "annual" ? "year" : "month" },
    metadata: {
      plan_template_id: planTemplateId,
      billing_period: billingPeriod,
    },
  });

  return price.id;
}

/** Creates or updates Stripe Products/Prices for active paid catalog tiers (USD). */
export async function syncStripeCatalog(
  admin: SupabaseClient,
  stripe: Stripe,
): Promise<StripeCatalogSyncResult[]> {
  const plans = await loadPaidActivePlans(admin);
  const results: StripeCatalogSyncResult[] = [];

  for (const plan of plans) {
    const productId = await ensureStripeProduct(stripe, plan);
    const monthlyPriceId = await ensureStripePrice(
      stripe,
      productId,
      plan.id,
      "monthly",
      plan.monthly_price_cents,
      plan.stripe_price_monthly_id,
    );

    let annualPriceId: string | null = null;
    const annualCents = annualChargeCents(plan);
    if (annualCents > 0) {
      annualPriceId = await ensureStripePrice(
        stripe,
        productId,
        plan.id,
        "annual",
        annualCents,
        plan.stripe_price_annual_id,
      );
    }

    const { error } = await admin
      .from("plan_templates")
      .update({
        stripe_product_id: productId,
        stripe_price_monthly_id: monthlyPriceId,
        stripe_price_annual_id: annualPriceId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", plan.id);

    if (error) {
      throw new Error(`Failed to save Stripe ids for ${plan.name}: ${error.message}`);
    }

    results.push({
      planId: plan.id,
      planName: plan.name,
      productId,
      monthlyPriceId,
      annualPriceId,
    });
  }

  return results;
}
