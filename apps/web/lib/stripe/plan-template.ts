import type { PlanTemplate } from "@signage/types";
import type { BillingPeriod } from "@/components/plans/plan-data";

export function isPaidPlanTemplate(plan: Pick<PlanTemplate, "monthly_price_cents">): boolean {
  return plan.monthly_price_cents > 0;
}

export function resolveStripePriceId(plan: PlanTemplate, billingPeriod: BillingPeriod): string | null {
  if (billingPeriod === "annual") {
    return plan.stripe_price_annual_id?.trim() || null;
  }
  return plan.stripe_price_monthly_id?.trim() || null;
}

export function annualChargeCents(plan: PlanTemplate): number {
  const monthlyEquivalent = plan.annual_monthly_price_cents ?? 0;
  return monthlyEquivalent > 0 ? monthlyEquivalent * 12 : 0;
}
