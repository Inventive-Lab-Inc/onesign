import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { cancelOtherActiveSubscriptions, findLiveSubscription } from "@/lib/stripe/change-subscription";
import { isStripeConfigured } from "@/lib/stripe/config";
import { getStripeClient } from "@/lib/stripe/client";
import { requireStripeAccountAdmin } from "@/lib/stripe/route-auth";
import {
  getSupabaseAdminForStripe,
  syncSubscriptionForUser,
} from "@/lib/stripe/subscription-handlers";

export const runtime = "nodejs";

type SyncBody = {
  checkoutSessionId?: string;
};

function readCustomerId(
  value: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function readSubscriptionId(value: string | Stripe.Subscription | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function sessionBelongsToUser(session: Stripe.Checkout.Session, userId: string): boolean {
  const fromMeta = session.metadata?.onesign_user_id?.trim();
  if (fromMeta) return fromMeta === userId;
  const fromRef = session.client_reference_id?.trim();
  if (fromRef) return fromRef === userId;
  return false;
}

/** Fallback when webhooks are delayed — sync Stripe → profile for this account. */
export async function POST(request: NextRequest) {
  const auth = await requireStripeAccountAdmin(request);
  if (auth instanceof NextResponse) return auth;

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  let body: SyncBody = {};
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    body = {};
  }

  const checkoutSessionId = body.checkoutSessionId?.trim() || null;
  const admin = getSupabaseAdminForStripe();
  const stripe = getStripeClient();
  const accountOwnerId = auth.account.accountOwnerId;

  try {
    if (checkoutSessionId) {
      const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
        expand: ["subscription"],
      });

      if (!sessionBelongsToUser(session, accountOwnerId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (session.mode !== "subscription") {
        return NextResponse.json({ error: "Checkout session is not a subscription" }, { status: 400 });
      }

      const customerId = readCustomerId(session.customer);
      const subscriptionId = readSubscriptionId(
        session.subscription as string | Stripe.Subscription | null,
      );

      if (!customerId || !subscriptionId) {
        return NextResponse.json(
          { error: "Checkout session has no subscription yet. Try again in a moment." },
          { status: 409 },
        );
      }

      const subscription =
        typeof session.subscription === "object" &&
        session.subscription &&
        !("deleted" in session.subscription)
          ? (session.subscription as Stripe.Subscription)
          : await stripe.subscriptions.retrieve(subscriptionId);

      await syncSubscriptionForUser(stripe, admin, accountOwnerId, customerId, subscription);
      await cancelOtherActiveSubscriptions({
        stripe,
        customerId,
        keepSubscriptionId: subscription.id,
        userId: accountOwnerId,
      });

      return NextResponse.json({
        ok: true,
        subscriptionId: subscription.id,
        status: subscription.status,
        source: "checkout_session",
      });
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("id", accountOwnerId)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    const customerId = profile?.stripe_customer_id?.trim();
    if (!customerId) {
      return NextResponse.json({ error: "No Stripe customer on this account" }, { status: 400 });
    }

    const active = await findLiveSubscription(
      stripe,
      customerId,
      profile?.stripe_subscription_id,
    );

    if (!active) {
      return NextResponse.json({ ok: true, subscriptionId: null, status: "none" });
    }

    await syncSubscriptionForUser(stripe, admin, accountOwnerId, customerId, active);
    await cancelOtherActiveSubscriptions({
      stripe,
      customerId,
      keepSubscriptionId: active.id,
      userId: accountOwnerId,
    });

    return NextResponse.json({
      ok: true,
      subscriptionId: active.id,
      status: active.status,
      source: "customer",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Subscription sync failed";
    console.error("[stripe/sync-subscription]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
