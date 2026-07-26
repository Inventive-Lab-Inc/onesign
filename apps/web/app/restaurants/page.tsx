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
  title: "Digital Menu Board Software for Restaurants",
  description:
    "Display and update your restaurant menu boards instantly. Schedule breakfast, lunch, and dinner menus to switch automatically. Start your 14-day free trial.",
  openGraph: {
    title: "Digital Menu Board Software for Restaurants | OneSign",
    description:
      "Display and update your restaurant menu boards instantly. Schedule breakfast, lunch, and dinner menus to switch automatically. Start your 14-day free trial.",
  },
  twitter: {
    title: "Digital Menu Board Software for Restaurants | OneSign",
    description:
      "Display and update your restaurant menu boards instantly. Schedule breakfast, lunch, and dinner menus to switch automatically. Start your 14-day free trial.",
  },
};

const verticalConfig: VerticalConfig = {
  slug: "restaurants",
  heroTitle: "Menu boards that",
  heroAccent: "sell themselves",
  heroDescription:
    "OneSign turns any TV into a dynamic menu board. Update prices, add daily specials, and schedule daypart menus — all from your phone or laptop.",
  introParagraph:
    "Whether you run a fast-casual spot, a full-service restaurant, or a QSR chain, OneSign helps you display mouthwatering menus that drive orders. Schedule breakfast, lunch, and dinner menus to switch automatically so your screens always show the right items at the right time.",
  heroImageSrc: "/images/landing/mockup-v2-restaurant-menu.webp",
  heroImageAlt: "Digital menu board above the counter in a fast-casual burger restaurant",
};

export default async function RestaurantsPage() {
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
