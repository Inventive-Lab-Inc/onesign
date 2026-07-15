import { describe, expect, it, vi } from "vitest";
import { getPlanAction } from "@/lib/plan/billing";
import type { PlanViewModel } from "@/components/plans/plan-data";
import type { PlanQuotaSnapshot } from "@/lib/plan-quota";

vi.mock("@/lib/stripe/config", () => ({
  isStripeCheckoutAvailable: () => true,
}));

const solo: PlanViewModel = {
  id: "solo-id",
  slug: "solo",
  name: "Solo",
  tagline: "One screen",
  currency: "USD",
  monthlyPrice: 9,
  originalPrice: 12,
  monthlyPriceLabel: "$9",
  originalPriceLabel: "$12",
  annualMonthlyPrice: 7,
  annualMonthlyPriceLabel: "$7",
  annualOriginalPrice: 9,
  annualOriginalPriceLabel: "$9",
  perScreenLabel: "$9 per screen",
  annualPerScreenLabel: "$7 per screen",
  deviceLimit: 1,
  screens: "1 screen",
  features: ["500 MB storage"],
  ctaLabel: "Choose Solo",
  highlighted: false,
  badge: null,
  isFree: false,
};

const growth: PlanViewModel = {
  ...solo,
  id: "growth-id",
  slug: "growth",
  name: "Growth",
  deviceLimit: 5,
  screens: "5 screens",
};

const trialQuota: PlanQuotaSnapshot = {
  deviceLimit: 1,
  deviceCount: 1,
  storageLimitBytes: 524288000,
  storageUsedBytes: 0,
  trialEndsAt: new Date(Date.now() + 86400000).toISOString(),
  planKind: "trial",
  isOnTrial: true,
};

describe("getPlanAction with Stripe checkout", () => {
  it("returns checkout action for upgrade from trial", () => {
    const action = getPlanAction(solo, growth, trialQuota, "monthly");

    expect(action).toEqual({
      kind: "upgrade",
      label: "Upgrade to Growth",
      planId: "growth-id",
      billingPeriod: "monthly",
    });
  });

  it("offers checkout to convert the current trial tier to paid", () => {
    const action = getPlanAction(solo, solo, trialQuota, "monthly");

    expect(action).toEqual({
      kind: "checkout",
      label: "Subscribe to Solo",
      planId: "solo-id",
      billingPeriod: "monthly",
    });
  });
});
