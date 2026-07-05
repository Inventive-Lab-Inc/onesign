import { NextResponse, type NextRequest } from "next/server";
import type { BillingPeriod } from "@/components/plans/plan-data";
import { fetchAccountContext } from "@/lib/workspace/account-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getStripeAppOrigin, isStripeConfigured } from "@/lib/stripe/config";
import { getStripeClient } from "@/lib/stripe/client";
import { resolveStripePriceId } from "@/lib/stripe/plan-template";
import { fetchAuthEmail, getSupabaseAdminForStripe } from "@/lib/stripe/subscription-handlers";
import type { PlanTemplate } from "@signage/types";

export const runtime = "nodejs";

type CheckoutBody = {
  planTemplateId?: string;
  billingPeriod?: BillingPeriod;
};

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const supabase = getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await fetchAccountContext(supabase, user.id);
  if (!account.canAdminAccount) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: CheckoutBody;
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const planTemplateId = body.planTemplateId?.trim();
  const billingPeriod = body.billingPeriod === "annual" ? "annual" : "monthly";

  if (!planTemplateId) {
    return NextResponse.json({ error: "planTemplateId is required" }, { status: 400 });
  }

  const { data: plan, error: planError } = await supabase
    .from("plan_templates")
    .select("*")
    .eq("id", planTemplateId)
    .eq("is_active", true)
    .maybeSingle();

  if (planError) {
    return NextResponse.json({ error: planError.message }, { status: 400 });
  }

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const template = plan as PlanTemplate;
  if (template.monthly_price_cents <= 0) {
    return NextResponse.json({ error: "Plan is not billable" }, { status: 400 });
  }

  const priceId = resolveStripePriceId(template, billingPeriod);
  if (!priceId) {
    return NextResponse.json(
      { error: "Stripe price is not configured for this plan. Run sync-stripe-catalog." },
      { status: 503 },
    );
  }

  const accountOwnerId = account.accountOwnerId;
  const admin = getSupabaseAdminForStripe();
  const stripe = getStripeClient();
  const origin = getStripeAppOrigin();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("stripe_customer_id, client_name")
    .eq("id", accountOwnerId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  let customerId = profile?.stripe_customer_id?.trim() || null;

  if (!customerId) {
    const email = await fetchAuthEmail(admin, accountOwnerId);
    if (!email) {
      return NextResponse.json({ error: "Account email is required for checkout" }, { status: 400 });
    }

    const customer = await stripe.customers.create({
      email,
      name: profile?.client_name?.trim() || undefined,
      metadata: {
        onesign_user_id: accountOwnerId,
      },
    });

    customerId = customer.id;

    const { error: saveCustomerError } = await admin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", accountOwnerId);

    if (saveCustomerError) {
      return NextResponse.json({ error: saveCustomerError.message }, { status: 400 });
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/account?tab=billing&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/account?tab=billing&checkout=cancel`,
    client_reference_id: accountOwnerId,
    subscription_data: {
      metadata: {
        onesign_user_id: accountOwnerId,
        plan_template_id: planTemplateId,
      },
    },
    metadata: {
      onesign_user_id: accountOwnerId,
      plan_template_id: planTemplateId,
      billing_period: billingPeriod,
    },
    allow_promotion_codes: true,
  });

  if (!session.url) {
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
