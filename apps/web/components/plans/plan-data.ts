import { Building2, Rocket, Store, type LucideIcon } from "lucide-react";

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
