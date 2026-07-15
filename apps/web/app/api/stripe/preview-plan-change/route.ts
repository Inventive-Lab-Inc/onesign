import { NextResponse, type NextRequest } from "next/server";
import type { BillingPeriod } from "@/components/plans/plan-data";
import type { PlanTemplate } from "@signage/types";
import { getStripeClient } from "@/lib/stripe/client";
import {
  buildPlanChangeConfirmCopy,
  previewPlanChange,
} from "@/lib/stripe/preview-plan-change";
import { resolveStripePriceId } from "@/lib/stripe/plan-template";
import { requireStripeAccountAdmin } from "@/lib/stripe/route-auth";
import { getSupabaseAdminForStripe } from "@/lib/stripe/subscription-handlers";

export const runtime = "nodejs";

type PreviewBody = {
  planTemplateId?: string;
  billingPeriod?: BillingPeriod;
};

export async function POST(request: NextRequest) {
  const auth = await requireStripeAccountAdmin(request);
  if (auth instanceof NextResponse) return auth;

  let body: PreviewBody;
  try {
    body = (await request.json()) as PreviewBody;
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

  const [{ data: plan, error: planError }, { data: profile, error: profileError }] =
    await Promise.all([
      admin
        .from("plan_templates")
        .select("*")
        .eq("id", planTemplateId)
        .eq("is_active", true)
        .maybeSingle(),
      admin
        .from("profiles")
        .select(
          "stripe_customer_id, stripe_subscription_id, plan_template_id, device_limit, plan_kind, trial_ends_at",
        )
        .eq("id", accountOwnerId)
        .maybeSingle(),
    ]);

  if (planError) {
    return NextResponse.json({ error: planError.message }, { status: 400 });
  }
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const template = plan as PlanTemplate;
  if (template.monthly_price_cents <= 0) {
    return NextResponse.json({ error: "Plan is not billable" }, { status: 400 });
  }

  const priceId = resolveStripePriceId(template, billingPeriod);
  if (!priceId) {
    return NextResponse.json(
      { error: "Stripe price is not configured for this plan." },
      { status: 503 },
    );
  }

  const displayPriceCents =
    billingPeriod === "annual"
      ? (template.annual_monthly_price_cents ?? Math.round(template.monthly_price_cents * 0.8))
      : template.monthly_price_cents;

  let currentPlanName: string | null = null;
  let currentDeviceLimit: number | null = profile?.device_limit ?? null;
  const currentTemplateId = profile?.plan_template_id?.trim() || null;
  if (currentTemplateId) {
    const { data: currentPlan } = await admin
      .from("plan_templates")
      .select("name, device_limit")
      .eq("id", currentTemplateId)
      .maybeSingle();
    currentPlanName = currentPlan?.name?.trim() || null;
    if (typeof currentPlan?.device_limit === "number") {
      currentDeviceLimit = currentPlan.device_limit;
    }
  }

  const preview = await previewPlanChange({
    stripe,
    customerId: profile?.stripe_customer_id?.trim() || null,
    knownSubscriptionId: profile?.stripe_subscription_id,
    targetPriceId: priceId,
    targetPlanName: template.name,
    targetPriceCents: displayPriceCents,
    currentPlanName,
    currentDeviceLimit,
    targetDeviceLimit: template.device_limit,
  });

  const copy = buildPlanChangeConfirmCopy(preview);

  return NextResponse.json({
    ...preview,
    copy,
  });
}
