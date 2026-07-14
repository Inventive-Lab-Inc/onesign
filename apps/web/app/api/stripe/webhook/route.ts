import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import {
  cancelOtherActiveSubscriptions,
  findLiveSubscription,
} from "@/lib/stripe/change-subscription";
import { getStripeWebhookSecret } from "@/lib/stripe/config";
import { getStripeClient } from "@/lib/stripe/client";
import {
  claimWebhookEvent,
  findUserIdByStripeCustomerId,
  findUserIdByStripeSubscriptionId,
  getSupabaseAdminForStripe,
  revokeSubscriptionFromProfile,
  syncSubscriptionForUser,
} from "@/lib/stripe/subscription-handlers";

export const runtime = "nodejs";

function readCustomerId(value: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function readSubscriptionId(value: string | Stripe.Subscription | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

async function resolveUserId(
  admin: ReturnType<typeof getSupabaseAdminForStripe>,
  stripe: ReturnType<typeof getStripeClient>,
  session: Stripe.Checkout.Session,
): Promise<string | null> {
  const fromMetadata = session.metadata?.onesign_user_id?.trim();
  if (fromMetadata) return fromMetadata;

  const fromReference = session.client_reference_id?.trim();
  if (fromReference) return fromReference;

  const customerId = readCustomerId(session.customer);
  if (customerId) {
    return findUserIdByStripeCustomerId(admin, customerId);
  }

  const subscriptionId = readSubscriptionId(session.subscription);
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const fromSub = subscription.metadata?.onesign_user_id?.trim();
    if (fromSub) return fromSub;
    return findUserIdByStripeSubscriptionId(admin, subscriptionId);
  }

  return null;
}

export async function POST(request: NextRequest) {
  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook secret is not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const stripe = getStripeClient();
  const admin = getSupabaseAdminForStripe();
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature";
    console.error("[stripe/webhook] signature", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const claimed = await claimWebhookEvent(admin, event.id, event.type);
  if (!claimed) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const userId = await resolveUserId(admin, stripe, session);
        const customerId = readCustomerId(session.customer);
        const subscriptionId = readSubscriptionId(session.subscription);

        if (!userId || !customerId || !subscriptionId) {
          throw new Error("checkout.session.completed missing user, customer, or subscription");
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscriptionForUser(stripe, admin, userId, customerId, subscription);
        // Deduplicate: Checkout must never leave multiple active Onesign subs.
        await cancelOtherActiveSubscriptions({
          stripe,
          customerId,
          keepSubscriptionId: subscription.id,
          userId,
        });
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = readCustomerId(subscription.customer);
        if (!customerId) break;

        const userId =
          subscription.metadata?.onesign_user_id?.trim() ||
          (await findUserIdByStripeSubscriptionId(admin, subscription.id)) ||
          (await findUserIdByStripeCustomerId(admin, customerId));

        if (!userId) break;

        await syncSubscriptionForUser(stripe, admin, userId, customerId, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = readCustomerId(subscription.customer);
        if (!customerId) break;

        const userId =
          subscription.metadata?.onesign_user_id?.trim() ||
          (await findUserIdByStripeSubscriptionId(admin, subscription.id)) ||
          (await findUserIdByStripeCustomerId(admin, customerId));

        if (!userId) break;

        // Never revoke just because we canceled a duplicate. If another live
        // subscription remains, keep that plan on the profile.
        const remaining = await findLiveSubscription(stripe, customerId, null);
        if (remaining) {
          await syncSubscriptionForUser(stripe, admin, userId, customerId, remaining);
          break;
        }

        await revokeSubscriptionFromProfile(admin, userId);
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error("[stripe/webhook]", event.type, error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
