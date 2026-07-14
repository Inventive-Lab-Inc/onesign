import { NextResponse, type NextRequest } from "next/server";
import type { BillingPeriod } from "@/components/plans/plan-data";
import type { PlanTemplate } from "@signage/types";
import { getStripeAppOrigin } from "@/lib/stripe/config";
import { getStripeClient } from "@/lib/stripe/client";
import {
  cancelOtherActiveSubscriptions,
  changeSubscriptionPrice,
  findLiveSubscription,
} from "@/lib/stripe/change-subscription";
import { resolveStripePriceId } from "@/lib/stripe/plan-template";
import { requireStripeAccountAdmin } from "@/lib/stripe/route-auth";
import { fetchAuthEmail, getSupabaseAdminForStripe } from "@/lib/stripe/subscription-handlers";

export const runtime = "nodejs";

type CheckoutBody = {
  planTemplateId?: string;
  billingPeriod?: BillingPeriod;
};

export async function POST(request: NextRequest) {
  const auth = await requireStripeAccountAdmin(request);
  if (auth instanceof NextResponse) return auth;

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

  const { data: plan, error: planError } = await auth.supabase
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

  const accountOwnerId = auth.account.accountOwnerId;
  const admin = getSupabaseAdminForStripe();
  const stripe = getStripeClient();
  const origin = getStripeAppOrigin();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("stripe_customer_id, stripe_subscription_id, client_name")
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

  const successPath = auth.isMobileClient
    ? `/mobile/billing-return?checkout=success`
    : `/account?tab=billing&checkout=success`;
  const cancelPath = auth.isMobileClient
    ? `/mobile/billing-return?checkout=cancel`
    : `/account?tab=billing&checkout=cancel`;

  try {
    // Existing subscriber → update the live subscription in place (prorated).
    const live = await findLiveSubscription(
      stripe,
      customerId,
      profile?.stripe_subscription_id,
    );

    if (live) {
      const updated = await changeSubscriptionPrice({
        stripe,
        admin,
        userId: accountOwnerId,
        customerId,
        subscription: live,
        priceId,
        planTemplateId,
      });
      await cancelOtherActiveSubscriptions({
        stripe,
        customerId,
        keepSubscriptionId: updated.id,
        userId: accountOwnerId,
      });

      return NextResponse.json({
        upgraded: true,
        redirectUrl: `${origin}${successPath}`,
        subscriptionId: updated.id,
        status: updated.status,
      });
    }

    // First paid plan → Stripe Checkout.
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}${successPath}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${cancelPath}`,
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create checkout session";
    console.error("[stripe/checkout]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
