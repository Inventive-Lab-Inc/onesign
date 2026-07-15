import { describe, expect, it } from "vitest";
import {
  buildPlanChangeConfirmCopy,
  formatBillingMoney,
  type PlanChangePreview,
} from "@/lib/stripe/preview-plan-change";

describe("formatBillingMoney", () => {
  it("formats whole dollars without cents", () => {
    expect(formatBillingMoney(8900)).toBe("$89");
  });

  it("keeps cents when needed", () => {
    expect(formatBillingMoney(4050)).toBe("$40.50");
  });
});

describe("buildPlanChangeConfirmCopy", () => {
  it("explains first payment checkout", () => {
    const preview: PlanChangePreview = {
      mode: "new_checkout",
      direction: "subscribe",
      targetPlanName: "Solo",
      currentPlanName: null,
      targetPriceCents: 900,
      currency: "usd",
      amountDueCents: 0,
      creditCents: 0,
      nextRenewalAt: null,
    };
    const copy = buildPlanChangeConfirmCopy(preview);
    expect(copy.title).toBe("Pay for Solo?");
    expect(copy.confirmLabel).toBe("Continue to payment");
    expect(copy.bullets[0]).toContain("$9/mo");
  });

  it("explains upgrade with estimated charge", () => {
    const preview: PlanChangePreview = {
      mode: "plan_switch",
      direction: "upgrade",
      targetPlanName: "Network",
      currentPlanName: "Solo",
      targetPriceCents: 8900,
      currency: "usd",
      amountDueCents: 4000,
      creditCents: 0,
      nextRenewalAt: null,
    };
    const copy = buildPlanChangeConfirmCopy(preview);
    expect(copy.title).toBe("Upgrade to Network?");
    expect(copy.confirmLabel).toBe("Confirm upgrade");
    expect(copy.bullets.some((b) => b.includes("$40"))).toBe(true);
    expect(copy.bullets.some((b) => b.includes("saved card"))).toBe(true);
  });

  it("explains downgrade with credit", () => {
    const preview: PlanChangePreview = {
      mode: "plan_switch",
      direction: "downgrade",
      targetPlanName: "Solo",
      currentPlanName: "Network",
      targetPriceCents: 900,
      currency: "usd",
      amountDueCents: 0,
      creditCents: 4000,
      nextRenewalAt: null,
    };
    const copy = buildPlanChangeConfirmCopy(preview);
    expect(copy.title).toBe("Switch to Solo?");
    expect(copy.confirmLabel).toBe("Confirm switch");
    expect(copy.bullets.some((b) => b.includes("credit"))).toBe(true);
    expect(copy.bullets.some((b) => b.includes("$40"))).toBe(true);
  });
});
