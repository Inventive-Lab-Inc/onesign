import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncSubscriptionForUser } from "@/lib/stripe/subscription-handlers";

const LIVE_STATUSES = new Set<Stripe.Subscription.Status>(["active", "trialing", "past_due"]);

export function planPriceMatchesTemplate(
  priceId: string,
  template: {
    stripe_price_monthly_id?: string | null;
    stripe_price_annual_id?: string | null;
  },
): boolean {
  return (
    template.stripe_price_monthly_id === priceId ||
    template.stripe_price_annual_id === priceId
  );
}

/** Find the account's live subscription (prefer the id stored on the profile). */
export async function findLiveSubscription(
  stripe: Stripe,
  customerId: string,
  knownSubscriptionId?: string | null,
): Promise<Stripe.Subscription | null> {
  const known = knownSubscriptionId?.trim();
  if (known) {
    try {
      const subscription = await stripe.subscriptions.retrieve(known);
      if (LIVE_STATUSES.has(subscription.status)) return subscription;
    } catch {
      // Fall through to list — id may be stale after a prior cancel.
    }
  }

  const listed = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
  });

  const live = listed.data
    .filter((sub) => LIVE_STATUSES.has(sub.status))
    .sort((a, b) => b.created - a.created);

  return live[0] ?? null;
}

/**
 * Change an existing subscription to a new catalog price (prorated).
 * Preferred path for upgrades/downgrades — avoids a second Checkout subscription.
 */
export async function changeSubscriptionPrice(params: {
  stripe: Stripe;
  admin: SupabaseClient;
  userId: string;
  customerId: string;
  subscription: Stripe.Subscription;
  priceId: string;
  planTemplateId: string;
}): Promise<Stripe.Subscription> {
  const { stripe, admin, userId, customerId, subscription, priceId, planTemplateId } = params;
  const item = subscription.items.data[0];
  if (!item?.id) {
    throw new Error("Subscription has no billable item to update");
  }

  const currentPriceId = typeof item.price === "string" ? item.price : item.price?.id;
  if (currentPriceId === priceId) {
    await syncSubscriptionForUser(stripe, admin, userId, customerId, subscription);
    return subscription;
  }

  const updated = await stripe.subscriptions.update(subscription.id, {
    items: [{ id: item.id, price: priceId }],
    proration_behavior: "create_prorations",
    cancel_at_period_end: false,
    metadata: {
      ...(subscription.metadata ?? {}),
      onesign_user_id: userId,
      plan_template_id: planTemplateId,
    },
  });

  await syncSubscriptionForUser(stripe, admin, userId, customerId, updated);
  return updated;
}

/**
 * Cancel extra active subscriptions on a customer, keeping one.
 * Only touches subscriptions tagged for this Onesign user (or missing tags, for cleanup).
 */
export async function cancelOtherActiveSubscriptions(params: {
  stripe: Stripe;
  customerId: string;
  keepSubscriptionId: string;
  userId: string;
}): Promise<void> {
  const { stripe, customerId, keepSubscriptionId, userId } = params;
  const others = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 20,
  });

  for (const sub of others.data) {
    if (sub.id === keepSubscriptionId) continue;
    const owner = sub.metadata?.onesign_user_id?.trim();
    if (owner && owner !== userId) continue;
    try {
      await stripe.subscriptions.cancel(sub.id);
    } catch (error) {
      console.warn("[stripe] cancel extra subscription", sub.id, error);
    }
  }
}
