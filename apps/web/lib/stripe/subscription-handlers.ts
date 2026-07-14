import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
]);

function planTemplateIdFromPrice(price: Stripe.Price | string | null | undefined): string | null {
  if (!price || typeof price === "string") return null;
  const fromMetadata = price.metadata?.plan_template_id?.trim();
  return fromMetadata || null;
}

async function planTemplateIdFromPriceLookup(
  admin: SupabaseClient,
  priceId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("plan_templates")
    .select("id")
    .or(`stripe_price_monthly_id.eq.${priceId},stripe_price_annual_id.eq.${priceId}`)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.warn("[stripe] plan lookup by price", error.message);
    return null;
  }

  return typeof data?.id === "string" ? data.id : null;
}

async function resolvePlanTemplateId(
  stripe: Stripe,
  admin: SupabaseClient,
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const fromSubscriptionMeta = subscription.metadata?.plan_template_id?.trim();
  if (fromSubscriptionMeta) return fromSubscriptionMeta;

  const item = subscription.items.data[0];
  if (!item?.price) return null;

  const direct = planTemplateIdFromPrice(item.price);
  if (direct) return direct;

  const priceId = typeof item.price === "string" ? item.price : item.price.id;
  const price = await stripe.prices.retrieve(priceId);
  const refreshed = planTemplateIdFromPrice(price);
  if (refreshed) return refreshed;

  return planTemplateIdFromPriceLookup(admin, priceId);
}

export async function applySubscriptionToProfile(
  stripe: Stripe,
  admin: SupabaseClient,
  userId: string,
  customerId: string,
  subscription: Stripe.Subscription,
): Promise<void> {
  const planTemplateId = await resolvePlanTemplateId(stripe, admin, subscription);
  if (!planTemplateId) {
    throw new Error("Missing plan_template_id on Stripe price metadata");
  }

  const { error } = await admin.rpc("apply_stripe_subscription", {
    p_user_id: userId,
    p_stripe_customer_id: customerId,
    p_stripe_subscription_id: subscription.id,
    p_subscription_status: subscription.status,
    p_plan_template_id: planTemplateId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function revokeSubscriptionFromProfile(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await admin.rpc("revoke_stripe_subscription", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function syncSubscriptionForUser(
  stripe: Stripe,
  admin: SupabaseClient,
  userId: string,
  customerId: string,
  subscription: Stripe.Subscription,
): Promise<void> {
  if (ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
    await applySubscriptionToProfile(stripe, admin, userId, customerId, subscription);
    return;
  }

  if (subscription.status === "canceled" || subscription.status === "unpaid") {
    await revokeSubscriptionFromProfile(admin, userId);
    return;
  }

  const { error } = await admin
    .from("profiles")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
    })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function findUserIdByStripeCustomerId(
  admin: SupabaseClient,
  customerId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.id ?? null;
}

export async function findUserIdByStripeSubscriptionId(
  admin: SupabaseClient,
  subscriptionId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.id ?? null;
}

export async function claimWebhookEvent(
  admin: SupabaseClient,
  eventId: string,
  eventType: string,
): Promise<boolean> {
  const { data, error } = await admin.rpc("claim_stripe_webhook_event", {
    p_event_id: eventId,
    p_event_type: eventType,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data === true;
}

export async function fetchAuthEmail(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) {
    throw new Error(error.message);
  }
  return data.user?.email?.trim() || null;
}

export function getSupabaseAdminForStripe(): SupabaseClient {
  return getSupabaseAdminClient();
}
