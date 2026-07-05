import type { PlanQuotaSnapshot } from "@/lib/plan-quota";
import type { BillingPeriod, PlanViewModel } from "@/components/plans/plan-data";
import { CUSTOM_PLAN } from "@/components/plans/plan-data";
import { isStripeCheckoutAvailable } from "@/lib/stripe/config";
import { isOnTrial } from "@/lib/trial";

export type PlanActionKind = "current" | "upgrade" | "downgrade" | "contact" | "checkout";

export interface PlanAction {
  kind: PlanActionKind;
  label: string;
  href?: string;
  planId?: string;
  billingPeriod?: BillingPeriod;
  disabled?: boolean;
}

const BILLING_CONTACT_EMAIL = "aminulislamborhan@gmail.com";

function billingPeriodLabel(billingPeriod: BillingPeriod): string {
  return billingPeriod === "annual" ? " (annual billing)" : "";
}

export function billingUpgradeMailto(planName: string, billingPeriod: BillingPeriod = "monthly"): string {
  return `mailto:${BILLING_CONTACT_EMAIL}?subject=${encodeURIComponent(`OneSign ${planName} plan${billingPeriodLabel(billingPeriod)}`)}`;
}

export function billingContactMailto(subject = "OneSign billing"): string {
  return `mailto:${BILLING_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

function paidPlanAction(
  target: PlanViewModel,
  billingPeriod: BillingPeriod,
  kind: Exclude<PlanActionKind, "current">,
  label: string,
): PlanAction {
  if (isStripeCheckoutEnabled() && !target.isFree) {
    return {
      kind: "checkout",
      label,
      planId: target.id,
      billingPeriod,
    };
  }

  return {
    kind: "contact",
    label,
    href: billingUpgradeMailto(target.name, billingPeriod),
  };
}

export function isStripeCheckoutEnabled(): boolean {
  return isStripeCheckoutAvailable();
}

/** Maps account quota to the closest catalog tier (by screen limit). */
export function matchCatalogPlan(
  plans: PlanViewModel[],
  quota: PlanQuotaSnapshot,
): PlanViewModel | null {
  if (quota.planKind === "custom") return null;

  const sorted = [...plans].sort((a, b) => a.deviceLimit - b.deviceLimit);
  const exact = sorted.find((plan) => plan.deviceLimit === quota.deviceLimit);
  if (exact) return exact;

  let best: PlanViewModel | null = null;
  for (const plan of sorted) {
    if (plan.deviceLimit <= quota.deviceLimit) best = plan;
  }
  return best ?? sorted[0] ?? null;
}

export function currentPlanLabel(
  plans: PlanViewModel[],
  quota: PlanQuotaSnapshot,
): { name: string; description: string; status: string } {
  const onTrial = quota.isOnTrial ?? isOnTrial(quota);
  const matched = matchCatalogPlan(plans, quota);

  if (quota.planKind === "custom") {
    return {
      name: CUSTOM_PLAN.name,
      description: CUSTOM_PLAN.tagline,
      status: "Active",
    };
  }

  if (onTrial) {
    return {
      name: matched?.name ? `${matched.name} trial` : "Solo trial",
      description: "Full Solo-tier limits while you evaluate OneSign.",
      status: "Trial",
    };
  }

  if (matched) {
    return {
      name: matched.name,
      description: matched.tagline,
      status: quota.planKind === "free" ? "Free" : "Active",
    };
  }

  return {
    name: "Standard",
    description: "Your account plan.",
    status: "Active",
  };
}

export function getPlanAction(
  current: PlanViewModel | null,
  target: PlanViewModel,
  quota: PlanQuotaSnapshot,
  billingPeriod: BillingPeriod = "monthly",
): PlanAction {
  const onTrial = quota.isOnTrial ?? isOnTrial(quota);

  if (onTrial && current?.id === target.id) {
    return { kind: "current", label: "Current trial", disabled: true };
  }

  if (!onTrial && current?.id === target.id) {
    return { kind: "current", label: "Current plan", disabled: true };
  }

  if (!current) {
    return paidPlanAction(target, billingPeriod, "contact", `Choose ${target.name}`);
  }

  if (target.deviceLimit > current.deviceLimit) {
    return paidPlanAction(target, billingPeriod, "upgrade", `Upgrade to ${target.name}`);
  }

  if (target.deviceLimit < current.deviceLimit) {
    return paidPlanAction(target, billingPeriod, "downgrade", `Switch to ${target.name}`);
  }

  return paidPlanAction(target, billingPeriod, "contact", `Choose ${target.name}`);
}
