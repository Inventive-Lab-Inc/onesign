import { NextResponse } from "next/server";
import { fetchAccountContext } from "@/lib/workspace/account-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getStripeAppOrigin, isStripeConfigured } from "@/lib/stripe/config";
import { getStripeClient } from "@/lib/stripe/client";
import { getSupabaseAdminForStripe } from "@/lib/stripe/subscription-handlers";

export const runtime = "nodejs";

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
    return NextResponse.json({ error: "No billing account yet" }, { status: 400 });
  }

  const stripe = getStripeClient();
  const origin = getStripeAppOrigin();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/account?tab=billing`,
  });

  return NextResponse.json({ url: session.url });
}
