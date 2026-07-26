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
  title: "Digital Signage for Cafés & Coffee Shops",
  description:
    "Showcase your drinks, pastries, and daily specials on beautiful digital menu boards. Update prices and seasonal items instantly. 14-day free trial.",
  openGraph: {
    title: "Digital Signage for Cafés & Coffee Shops | OneSign",
    description:
      "Showcase your drinks, pastries, and daily specials on beautiful digital menu boards. Update prices and seasonal items instantly. 14-day free trial.",
  },
  twitter: {
    title: "Digital Signage for Cafés & Coffee Shops | OneSign",
    description:
      "Showcase your drinks, pastries, and daily specials on beautiful digital menu boards. Update prices and seasonal items instantly. 14-day free trial.",
  },
};

const verticalConfig: VerticalConfig = {
  slug: "cafes",
  heroTitle: "Menu boards your",
  heroAccent: "customers will love",
  heroDescription:
    "OneSign makes it easy to display your coffee menu, pastry case, and daily specials on any TV. Update prices in seconds and keep your boards looking fresh.",
  introParagraph:
    "From single-origin pour-overs to seasonal lattes, your menu tells your story. OneSign helps independent cafés and coffee chains showcase their offerings on sleek digital boards that update instantly — no printing costs, no waiting for new signage.",
  heroImageSrc: "/images/landing/mockup-v2-cafe-menu.webp",
  heroImageAlt: "Digital drinks menu above the counter in a minimalist specialty coffee shop",
};

export default async function CafesPage() {
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
