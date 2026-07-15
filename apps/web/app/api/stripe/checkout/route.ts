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
import {
  fetchAuthEmail,
  getSupabaseAdminForStripe,
  syncSubscriptionForUser,
} from "@/lib/stripe/subscription-handlers";

export const runtime = "nodejs";

type CheckoutBody = {
  planTemplateId?: string;
  billingPeriod?: BillingPeriod;
};

function stripeErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Failed to create checkout session";
  }
  const maybe = error as { message?: string; raw?: { message?: string } };
  const raw = maybe.raw?.message?.trim() || maybe.message?.trim();
  return raw && raw.length <= 200 ? raw : "Failed to change subscription. Please try again.";
}

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

  const accountOwnerId = auth.account.accountOwnerId;
  const admin = getSupabaseAdminForStripe();
  const stripe = getStripeClient();
  const origin = getStripeAppOrigin();

  // Use service-role for catalog — avoids RLS quirks on Bearer mobile sessions.
  const { data: plan, error: planError } = await admin
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
    const live = await findLiveSubscription(
      stripe,
      customerId,
      profile?.stripe_subscription_id,
    );

    if (live) {
      const updated = await changeSubscriptionPrice({
        stripe,
        userId: accountOwnerId,
        subscription: live,
        priceId,
        planTemplateId,
      });

      try {
        await syncSubscriptionForUser(stripe, admin, accountOwnerId, customerId, updated);
      } catch (error) {
        console.error("[stripe/checkout] profile sync after plan change", error);
      }

      try {
        await cancelOtherActiveSubscriptions({
          stripe,
          customerId,
          keepSubscriptionId: updated.id,
          userId: accountOwnerId,
        });
      } catch (error) {
        console.warn("[stripe/checkout] cancel extras", error);
      }

      return NextResponse.json({
        upgraded: true,
        url: `${origin}${successPath}`,
        redirectUrl: `${origin}${successPath}`,
        subscriptionId: updated.id,
        status: updated.status,
      });
    }

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
    const message = stripeErrorMessage(error);
    console.error("[stripe/checkout]", message, error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
