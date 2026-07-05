import { describe, expect, it } from "vitest";
import type { PlanTemplate } from "@signage/types";
import {
  CLIENT_PLAN_CUSTOM_VALUE,
  CLIENT_PLAN_TRIAL_VALUE,
  computeTrialEndsAt,
  resolveClientProvisioning,
} from "@/lib/admin/client-provisioning";

const plans: PlanTemplate[] = [
  {
    id: "solo-id",
    name: "Solo",
    tagline: "",
    device_limit: 1,
    storage_limit_bytes: 524_288_000,
    monthly_price_cents: 900,
    original_price_cents: null,
    monthly_price_gbp_cents: 700,
    original_price_gbp_cents: null,
    monthly_price_eur_cents: 800,
    original_price_eur_cents: null,
    monthly_price_bdt_paisa: 90_000,
    original_price_bdt_paisa: null,
    annual_monthly_price_cents: 700,
    annual_monthly_price_gbp_cents: 600,
    annual_monthly_price_eur_cents: 700,
    annual_monthly_price_bdt_paisa: 70_000,
    original_annual_monthly_price_cents: null,
    original_annual_monthly_price_gbp_cents: null,
    original_annual_monthly_price_eur_cents: null,
    original_annual_monthly_price_bdt_paisa: null,
    cta_label: "Choose Solo",
    features: [],
    badge: null,
    is_highlighted: false,
    is_active: true,
    sort_order: 1,
  },
  {
    id: "growth-id",
    name: "Growth",
    tagline: "",
    device_limit: 5,
    storage_limit_bytes: 3_221_225_472,
    monthly_price_cents: 3900,
    original_price_cents: null,
    monthly_price_gbp_cents: 3200,
    original_price_gbp_cents: null,
    monthly_price_eur_cents: 3500,
    original_price_eur_cents: null,
    monthly_price_bdt_paisa: 390_000,
    original_price_bdt_paisa: null,
    annual_monthly_price_cents: 3200,
    annual_monthly_price_gbp_cents: 2600,
    annual_monthly_price_eur_cents: 2900,
    annual_monthly_price_bdt_paisa: 320_000,
    original_annual_monthly_price_cents: null,
    original_annual_monthly_price_gbp_cents: null,
    original_annual_monthly_price_eur_cents: null,
    original_annual_monthly_price_bdt_paisa: null,
    cta_label: "Choose Growth",
    features: [],
    badge: null,
    is_highlighted: true,
    is_active: true,
    sort_order: 2,
  },
];

describe("resolveClientProvisioning", () => {
  it("maps catalog plans to active standard accounts", () => {
    const resolved = resolveClientProvisioning(plans, {
      mode: "catalog",
      planTemplateId: "growth-id",
    });
    expect(resolved).toMatchObject({
      mode: "catalog",
      planName: "Growth",
      deviceLimit: 5,
      storageLimitBytes: 3_221_225_472,
      planKind: "standard",
      skipTrial: true,
      trialEndsAt: null,
    });
  });

  it("creates solo-style trials with custom day counts", () => {
    const resolved = resolveClientProvisioning(plans, {
      mode: "trial",
      trialDays: 21,
    });
    expect(resolved).toMatchObject({
      mode: "trial",
      planName: "Solo",
      deviceLimit: 1,
      planKind: "trial",
      skipTrial: false,
      trialDays: 21,
    });
    if ("error" in resolved) throw new Error("unexpected error");
    expect(resolved.trialEndsAt).toBe(computeTrialEndsAt(21));
  });

  it("accepts bespoke limits for custom provisioning", () => {
    const resolved = resolveClientProvisioning(plans, {
      mode: "custom",
      deviceLimit: 2,
      storageLimitBytes: 1_073_741_824,
    });
    expect(resolved).toMatchObject({
      mode: "custom",
      deviceLimit: 2,
      storageLimitBytes: 1_073_741_824,
      planKind: "custom",
      skipTrial: true,
    });
  });
});

describe("plan selection constants", () => {
  it("uses stable sentinel values for special options", () => {
    expect(CLIENT_PLAN_TRIAL_VALUE).toBe("__trial__");
    expect(CLIENT_PLAN_CUSTOM_VALUE).toBe("__custom__");
  });
});
