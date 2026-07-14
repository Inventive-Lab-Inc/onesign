import { NextResponse, type NextRequest } from "next/server";
import { getStripeAppOrigin } from "@/lib/stripe/config";
import { getStripeClient } from "@/lib/stripe/client";
import { requireStripeAccountAdmin } from "@/lib/stripe/route-auth";
import { getSupabaseAdminForStripe } from "@/lib/stripe/subscription-handlers";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireStripeAccountAdmin(request);
  if (auth instanceof NextResponse) return auth;

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
    return NextResponse.json({ error: "No billing account yet" }, { status: 400 });
  }

  const stripe = getStripeClient();
  const origin = getStripeAppOrigin();
  const returnUrl = auth.isMobileClient
    ? `${origin}/mobile/billing-return?checkout=portal`
    : `${origin}/account?tab=billing`;

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return NextResponse.json({ url: session.url });
}
