import { NextResponse, type NextRequest } from "next/server";
import { isStripeConfigured } from "@/lib/stripe/config";
import { getStripeClient } from "@/lib/stripe/client";
import { requireStripeAccountAdmin } from "@/lib/stripe/route-auth";
import {
  getSupabaseAdminForStripe,
  syncSubscriptionForUser,
} from "@/lib/stripe/subscription-handlers";

export const runtime = "nodejs";

/** Fallback when webhooks are unavailable — sync active Stripe subscription to the account profile. */
export async function POST(request: NextRequest) {
  const auth = await requireStripeAccountAdmin(request);
  if (auth instanceof NextResponse) return auth;

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const admin = getSupabaseAdminForStripe();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", auth.account.accountOwnerId)
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
    return NextResponse.json({ ok: true, subscriptionId: null, status: "none" });
  }

  await syncSubscriptionForUser(
    stripe,
    admin,
    auth.account.accountOwnerId,
    customerId,
    active,
  );

  return NextResponse.json({
    ok: true,
    subscriptionId: active.id,
    status: active.status,
  });
}
