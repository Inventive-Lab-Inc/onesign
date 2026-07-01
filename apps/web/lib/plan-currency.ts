import type { PlanTemplate } from "@signage/types";

export const PLAN_CURRENCIES = ["USD", "GBP", "EUR", "BDT"] as const;
export type PlanCurrency = (typeof PLAN_CURRENCIES)[number];

/** ISO 3166-1 alpha-2 codes that bill in EUR. */
const EUR_COUNTRY_CODES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
]);

export function resolvePlanCurrencyFromCountry(countryCode: string | null | undefined): PlanCurrency {
  const code = countryCode?.trim().toUpperCase();
  if (!code) return "USD";
  if (code === "BD") return "BDT";
  if (code === "GB") return "GBP";
  if (EUR_COUNTRY_CODES.has(code)) return "EUR";
  return "USD";
}

export function getRequestPlanCurrency(countryHeader: string | null): PlanCurrency {
  return resolvePlanCurrencyFromCountry(countryHeader);
}

export interface PlanPricePair {
  monthlyMinor: number;
  originalMinor: number | null;
}

export function getPlanPricesForCurrency(
  template: PlanTemplate,
  currency: PlanCurrency,
): PlanPricePair {
  switch (currency) {
    case "GBP":
      return {
        monthlyMinor: template.monthly_price_gbp_cents,
        originalMinor: template.original_price_gbp_cents,
      };
    case "EUR":
      return {
        monthlyMinor: template.monthly_price_eur_cents,
        originalMinor: template.original_price_eur_cents,
      };
    case "BDT":
      return {
        monthlyMinor: template.monthly_price_bdt_paisa,
        originalMinor: template.original_price_bdt_paisa,
      };
    default:
      return {
        monthlyMinor: template.monthly_price_cents,
        originalMinor: template.original_price_cents,
      };
  }
}

/** Converts stored minor units to a display amount (major units). */
export function minorToDisplayAmount(minor: number, currency: PlanCurrency): number {
  if (currency === "BDT") {
    return Math.round(minor) / 100;
  }
  return Math.round(minor) / 100;
}

export function formatPlanCurrencyAmount(amount: number, currency: PlanCurrency): string {
  const whole = Number.isInteger(amount);
  const formatted = whole ? String(amount) : amount.toFixed(2);

  switch (currency) {
    case "GBP":
      return `£${formatted}`;
    case "EUR":
      return `€${formatted}`;
    case "BDT":
      return `৳${formatted}`;
    default:
      return `$${formatted}`;
  }
}

export function formatPlanMinorUnits(minor: number, currency: PlanCurrency): string {
  return formatPlanCurrencyAmount(minorToDisplayAmount(minor, currency), currency);
}

export function planCurrencyLabel(currency: PlanCurrency): string {
  switch (currency) {
    case "GBP":
      return "GBP";
    case "EUR":
      return "EUR";
    case "BDT":
      return "BDT";
    default:
      return "USD";
  }
}

export function planCurrencyFooter(currency: PlanCurrency): string {
  return `Prices in ${planCurrencyLabel(currency)}. Taxes may apply. 14-day money-back guarantee.`;
}
