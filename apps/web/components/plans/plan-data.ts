import type { PlanTemplate } from "@signage/types";
import { Building2, Rocket, Store, type LucideIcon } from "lucide-react";
import {
  formatPlanCurrencyAmount,
  getPlanPricesForCurrency,
  minorToDisplayAmount,
  type PlanCurrency,
} from "@/lib/plan-currency";

export interface PlanFeature {
  label: string;
}

export interface Plan {
  id: "starter" | "business" | "enterprise";
  name: string;
  tagline: string;
  icon: LucideIcon;
  monthlyPrice: number;
  originalPrice: number;
  screens: string;
  features: PlanFeature[];
  ctaLabel: string;
  highlighted?: boolean;
  badge?: string;
}

/**
 * Suggested OneSign tiers. Pricing scales by the two metered resources the
 * platform actually enforces — connected screens and media storage — plus the
 * collaboration features each customer segment needs.
 */
export const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "For a single storefront",
    icon: Store,
    monthlyPrice: 19,
    originalPrice: 29,
    screens: "1 screen",
    ctaLabel: "Choose Starter",
    features: [
      { label: "2 GB media storage" },
      { label: "Image & video playlists" },
      { label: "Basic scheduling" },
      { label: "Email support" },
    ],
  },
  {
    id: "business",
    name: "Business",
    tagline: "For growing multi-location teams",
    icon: Rocket,
    monthlyPrice: 59,
    originalPrice: 79,
    screens: "5 screens",
    ctaLabel: "Choose Business",
    highlighted: true,
    badge: "MOST POPULAR",
    features: [
      { label: "25 GB media storage" },
      { label: "Screen groups & bulk deploy" },
      { label: "Website & live widgets" },
      { label: "Advanced scheduling" },
      { label: "Priority email support" },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For agencies & large networks",
    icon: Building2,
    monthlyPrice: 149,
    originalPrice: 199,
    screens: "20 screens",
    ctaLabel: "Choose Enterprise",
    features: [
      { label: "250 GB media storage" },
      { label: "Unlimited groups & playlists" },
      { label: "Audit logs & team roles" },
      { label: "Dedicated account manager" },
      { label: "Priority + phone support" },
    ],
  },
];

/**
 * Serializable plan shape safe to pass from a Server Component to the client
 * pricing view. Icons can't cross that boundary, so consumers resolve them by
 * position via {@link planIconForIndex}.
 */
export interface PlanViewModel {
  id: string;
  name: string;
  tagline: string;
  currency: PlanCurrency;
  monthlyPrice: number;
  originalPrice: number | null;
  monthlyPriceLabel: string;
  originalPriceLabel: string | null;
  screens: string;
  features: string[];
  ctaLabel: string;
  highlighted: boolean;
  badge: string | null;
}

const PLAN_ICONS: LucideIcon[] = [Store, Rocket, Building2];

export function planIconForIndex(index: number): LucideIcon {
  return PLAN_ICONS[index % PLAN_ICONS.length] ?? Store;
}

function formatScreensLabel(deviceLimit: number): string {
  return `${deviceLimit} screen${deviceLimit === 1 ? "" : "s"}`;
}

/** Maps an admin-managed plan template into the serializable pricing view shape. */
export function mapTemplateToViewModel(template: PlanTemplate, currency: PlanCurrency = "USD"): PlanViewModel {
  const { monthlyMinor, originalMinor } = getPlanPricesForCurrency(template, currency);
  const monthlyPrice = minorToDisplayAmount(monthlyMinor, currency);
  const originalPrice = originalMinor == null ? null : minorToDisplayAmount(originalMinor, currency);

  return {
    id: template.id,
    name: template.name,
    tagline: template.tagline,
    currency,
    monthlyPrice,
    originalPrice,
    monthlyPriceLabel: formatPlanCurrencyAmount(monthlyPrice, currency),
    originalPriceLabel:
      originalPrice == null ? null : formatPlanCurrencyAmount(originalPrice, currency),
    screens: formatScreensLabel(template.device_limit),
    features: template.features,
    ctaLabel: template.cta_label,
    highlighted: template.is_highlighted,
    badge: template.badge,
  };
}

/** Fallback used when the catalog is empty or unreachable. */
export function buildStaticPlanViewModels(currency: PlanCurrency = "USD"): PlanViewModel[] {
  return plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    tagline: plan.tagline,
    currency,
    monthlyPrice: plan.monthlyPrice,
    originalPrice: plan.originalPrice,
    monthlyPriceLabel: formatPlanCurrencyAmount(plan.monthlyPrice, currency),
    originalPriceLabel: formatPlanCurrencyAmount(plan.originalPrice, currency),
    screens: plan.screens,
    features: plan.features.map((feature) => feature.label),
    ctaLabel: plan.ctaLabel,
    highlighted: plan.highlighted ?? false,
    badge: plan.badge ?? null,
  }));
}

export const STATIC_PLAN_VIEW_MODELS: PlanViewModel[] = buildStaticPlanViewModels();
