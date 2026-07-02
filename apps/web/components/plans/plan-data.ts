import type { PlanTemplate } from "@signage/types";
import { Building2, Rocket, Store, type LucideIcon } from "lucide-react";
import {
  formatPlanCurrencyAmount,
  getPlanPricesForCurrency,
  minorToDisplayAmount,
  type PlanCurrency,
} from "@/lib/plan-currency";
import { type SignupPlanSlug } from "@/lib/plan/signup-link";

export interface PlanFeature {
  label: string;
}

export interface Plan {
  slug: SignupPlanSlug;
  name: string;
  tagline: string;
  icon: LucideIcon;
  monthlyPrice: number;
  originalPrice: number | null;
  annualMonthlyPrice: number | null;
  deviceLimit: number;
  features: PlanFeature[];
  ctaLabel: string;
  highlighted?: boolean;
  badge?: string;
}

/**
 * Acquisition-first OneSign tiers. Pricing scales by connected screens and media
 * storage — the two metered resources the platform enforces.
 */
export const plans: Plan[] = [
  {
    slug: "solo",
    name: "Solo",
    tagline: "For a single location",
    icon: Store,
    monthlyPrice: 9,
    originalPrice: 12,
    annualMonthlyPrice: 7,
    deviceLimit: 1,
    ctaLabel: "Start Solo trial",
    features: [
      { label: "500 MB media storage" },
      { label: "Scheduling & live widgets" },
      { label: "Email support" },
    ],
  },
  {
    slug: "growth",
    name: "Growth",
    tagline: "For growing multi-location teams",
    icon: Rocket,
    monthlyPrice: 39,
    originalPrice: 49,
    annualMonthlyPrice: 32,
    deviceLimit: 5,
    ctaLabel: "Choose Growth",
    highlighted: true,
    badge: "MOST POPULAR",
    features: [
      { label: "3 GB media storage" },
      { label: "Screen groups & bulk deploy" },
      { label: "Website & live widgets" },
      { label: "Advanced scheduling" },
      { label: "Priority email support" },
    ],
  },
  {
    slug: "network",
    name: "Network",
    tagline: "For agencies & larger fleets",
    icon: Building2,
    monthlyPrice: 89,
    originalPrice: 109,
    annualMonthlyPrice: 74,
    deviceLimit: 15,
    ctaLabel: "Choose Network",
    features: [
      { label: "10 GB media storage" },
      { label: "Unlimited groups & playlists" },
      { label: "Audit logs & team roles" },
      { label: "Priority + phone support" },
    ],
  },
];

export const CUSTOM_PLAN = {
  name: "Custom",
  tagline: "For 20+ screens or enterprise needs",
  screens: "20+ screens",
  features: [
    "Volume pricing",
    "SSO & advanced security",
    "Dedicated account manager",
    "Custom SLA & onboarding",
  ],
  ctaLabel: "Contact sales",
  mailtoSubject: "OneSign%20Custom%20plan",
} as const;

/**
 * Serializable plan shape safe to pass from a Server Component to the client
 * pricing view. Icons can't cross that boundary, so consumers resolve them by
 * position via {@link planIconForIndex}.
 */
export interface PlanViewModel {
  id: string;
  slug: SignupPlanSlug | null;
  name: string;
  tagline: string;
  currency: PlanCurrency;
  monthlyPrice: number;
  originalPrice: number | null;
  monthlyPriceLabel: string;
  originalPriceLabel: string | null;
  annualMonthlyPriceLabel: string | null;
  perScreenLabel: string | null;
  deviceLimit: number;
  screens: string;
  features: string[];
  ctaLabel: string;
  highlighted: boolean;
  badge: string | null;
  isFree: boolean;
}

const PLAN_ICONS: LucideIcon[] = plans.map((plan) => plan.icon);

const ANNUAL_MONTHLY_BY_SLUG: Record<
  SignupPlanSlug,
  Record<PlanCurrency, number>
> = {
  solo: { USD: 7, GBP: 6, EUR: 7, BDT: 700 },
  growth: { USD: 32, GBP: 26, EUR: 29, BDT: 3200 },
  network: { USD: 74, GBP: 62, EUR: 68, BDT: 7400 },
};

export function planIconForIndex(index: number): LucideIcon {
  return PLAN_ICONS[index % PLAN_ICONS.length] ?? Store;
}

function formatScreensLabel(deviceLimit: number): string {
  return `${deviceLimit} screen${deviceLimit === 1 ? "" : "s"}`;
}

function slugFromPlanName(name: string): SignupPlanSlug | null {
  const normalized = name.trim().toLowerCase();
  if (normalized === "solo") return "solo";
  if (normalized === "growth") return "growth";
  if (normalized === "network") return "network";
  return null;
}

function perScreenLabel(
  monthlyPrice: number,
  deviceLimit: number,
  currency: PlanCurrency,
  isFree: boolean,
): string | null {
  if (isFree || deviceLimit <= 1) return null;
  const perScreen = monthlyPrice / deviceLimit;
  return `${formatPlanCurrencyAmount(perScreen, currency)}/screen`;
}

function annualMonthlyLabel(slug: SignupPlanSlug | null, currency: PlanCurrency): string | null {
  if (!slug) return null;
  const amount = ANNUAL_MONTHLY_BY_SLUG[slug][currency];
  return formatPlanCurrencyAmount(amount, currency);
}

/** Maps an admin-managed plan template into the serializable pricing view shape. */
export function mapTemplateToViewModel(template: PlanTemplate, currency: PlanCurrency = "USD"): PlanViewModel {
  const { monthlyMinor, originalMinor } = getPlanPricesForCurrency(template, currency);
  const monthlyPrice = minorToDisplayAmount(monthlyMinor, currency);
  const originalPrice = originalMinor == null ? null : minorToDisplayAmount(originalMinor, currency);
  const slug = slugFromPlanName(template.name);
  const isFree = monthlyPrice <= 0;

  return {
    id: template.id,
    slug,
    name: template.name,
    tagline: template.tagline,
    currency,
    monthlyPrice,
    originalPrice,
    monthlyPriceLabel: isFree ? "Free" : formatPlanCurrencyAmount(monthlyPrice, currency),
    originalPriceLabel:
      originalPrice == null || isFree ? null : formatPlanCurrencyAmount(originalPrice, currency),
    annualMonthlyPriceLabel: annualMonthlyLabel(slug, currency),
    perScreenLabel: perScreenLabel(monthlyPrice, template.device_limit, currency, isFree),
    deviceLimit: template.device_limit,
    screens: formatScreensLabel(template.device_limit),
    features: template.features,
    ctaLabel: template.cta_label,
    highlighted: template.is_highlighted,
    badge: template.badge,
    isFree,
  };
}

/** Fallback used when the catalog is empty or unreachable. */
export function buildStaticPlanViewModels(currency: PlanCurrency = "USD"): PlanViewModel[] {
  return plans.map((plan) => {
    const isFree = plan.monthlyPrice <= 0;
    return {
      id: plan.slug,
      slug: plan.slug,
      name: plan.name,
      tagline: plan.tagline,
      currency,
      monthlyPrice: plan.monthlyPrice,
      originalPrice: plan.originalPrice,
      monthlyPriceLabel: isFree ? "Free" : formatPlanCurrencyAmount(plan.monthlyPrice, currency),
      originalPriceLabel:
        plan.originalPrice == null || isFree
          ? null
          : formatPlanCurrencyAmount(plan.originalPrice, currency),
      annualMonthlyPriceLabel:
        plan.annualMonthlyPrice == null
          ? null
          : formatPlanCurrencyAmount(plan.annualMonthlyPrice, currency),
      perScreenLabel: perScreenLabel(plan.monthlyPrice, plan.deviceLimit, currency, isFree),
      deviceLimit: plan.deviceLimit,
      screens: formatScreensLabel(plan.deviceLimit),
      features: plan.features.map((feature) => feature.label),
      ctaLabel: plan.ctaLabel,
      highlighted: plan.highlighted ?? false,
      badge: plan.badge ?? null,
      isFree,
    };
  });
}

export const STATIC_PLAN_VIEW_MODELS: PlanViewModel[] = buildStaticPlanViewModels();

/** Tailwind grid column classes for a plan card row (matches card count). */
export function planGridClassName(count: number): string {
  if (count >= 4) return "md:grid-cols-2 xl:grid-cols-4";
  if (count === 3) return "md:grid-cols-3";
  if (count === 2) return "md:grid-cols-2";
  return "";
}
