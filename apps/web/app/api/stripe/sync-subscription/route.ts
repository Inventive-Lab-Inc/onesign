import { NextResponse } from "next/server";
import { fetchAccountContext } from "@/lib/workspace/account-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isStripeConfigured } from "@/lib/stripe/config";
import { getStripeClient } from "@/lib/stripe/client";
import {
  getSupabaseAdminForStripe,
  syncSubscriptionForUser,
} from "@/lib/stripe/subscription-handlers";

export const runtime = "nodejs";

/** Fallback when webhooks are unavailable — sync active Stripe subscription to the account profile. */
export async function POST() {
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

  const admin = getSupabaseAdminForStripe();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", account.accountOwnerId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const customerId = profile?.stripe_customer_id?.trim();
  if (!customerId) {
    return NextResponse.json({ error: "No Stripe customer on this account" }, { status: 400 });
  }

  const stripe = getStripeClient();
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
  });

  const active =
    subscriptions.data.find((sub) => sub.status === "active" || sub.status === "trialing") ??
    subscriptions.data.find((sub) => sub.status === "past_due");

  if (!active) {
    return NextResponse.json({ error: "No active subscription found in Stripe" }, { status: 404 });
  }

  await syncSubscriptionForUser(stripe, admin, account.accountOwnerId, customerId, active);

  return NextResponse.json({
    ok: true,
    subscriptionId: active.id,
    status: active.status,
  });
}
