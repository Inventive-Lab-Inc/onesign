import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { PlanTemplate } from "@signage/types";
import { VerticalLandingPage, type VerticalConfig } from "@/components/landing/vertical-landing-page";
import { buildStaticPlanViewModels, mapTemplateToViewModel } from "@/components/plans/plan-data";
import { getServerAuth } from "@/lib/supabase/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getRequestPlanCurrency } from "@/lib/plan-currency";
import { appUrl, isMarketingHost, normalizeHost } from "@/lib/site-hosts";

export const metadata: Metadata = {
  title: "Digital Signage Software for Retail Stores",
  description:
    "Turn window displays and in-store TVs into dynamic sales tools. Promote sales, new arrivals, and seasonal campaigns instantly. 14-day free trial.",
  openGraph: {
    title: "Digital Signage Software for Retail Stores | OneSign",
    description:
      "Turn window displays and in-store TVs into dynamic sales tools. Promote sales, new arrivals, and seasonal campaigns instantly. 14-day free trial.",
  },
  twitter: {
    title: "Digital Signage Software for Retail Stores | OneSign",
    description:
      "Turn window displays and in-store TVs into dynamic sales tools. Promote sales, new arrivals, and seasonal campaigns instantly. 14-day free trial.",
  },
};

const verticalConfig: VerticalConfig = {
  slug: "retail",
  heroTitle: "Displays that",
  heroAccent: "drive foot traffic",
  heroDescription:
    "OneSign turns your storefront windows and in-store TVs into attention-grabbing promotional displays. Update sales, feature new arrivals, and run holiday campaigns across all locations.",
  introParagraph:
    "Your window display is your biggest advertising asset. With OneSign, you can change promos in real-time, schedule weekend sales in advance, and sync content across every store — all without touching the TV.",
  heroImageSrc: "/images/landing/mockup-v2-retail-window.webp",
  heroImageAlt: "Storefront window display showing a storewide discount at golden hour",
};

export default async function RetailPage() {
  const host = headers().get("host");
  const { user } = await getServerAuth();

  const showLanding =
    isMarketingHost(host) ||
    (process.env.NODE_ENV === "development" && normalizeHost(host) === "localhost");

  if (!showLanding) {
    redirect(user ? "/dashboard" : "/login");
  }

  if (user) {
    redirect(appUrl("/dashboard"));
  }

  const currency = getRequestPlanCurrency(headers().get("x-vercel-ip-country"));
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_active_plans");
  const plans =
    error || !data || data.length === 0
      ? buildStaticPlanViewModels(currency)
      : (data as PlanTemplate[]).map((template) => mapTemplateToViewModel(template, currency));

  return <VerticalLandingPage vertical={verticalConfig} plans={plans} currency={currency} />;
}
