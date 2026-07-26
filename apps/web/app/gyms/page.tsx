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
  title: "Digital Signage for Gyms & Fitness Studios",
  description:
    "Display class schedules, motivational content, and membership promos on your gym TVs. Update in real-time from anywhere. 14-day free trial.",
  openGraph: {
    title: "Digital Signage for Gyms & Fitness Studios | OneSign",
    description:
      "Display class schedules, motivational content, and membership promos on your gym TVs. Update in real-time from anywhere. 14-day free trial.",
  },
  twitter: {
    title: "Digital Signage for Gyms & Fitness Studios | OneSign",
    description:
      "Display class schedules, motivational content, and membership promos on your gym TVs. Update in real-time from anywhere. 14-day free trial.",
  },
};

const verticalConfig: VerticalConfig = {
  slug: "gyms",
  heroTitle: "Screens that keep",
  heroAccent: "members motivated",
  heroDescription:
    "OneSign powers the TVs in your gym lobby, locker rooms, and workout floor. Display class schedules, trainer spotlights, and membership offers that update automatically.",
  introParagraph:
    "From boutique fitness studios to large gym chains, OneSign helps you communicate with members throughout the facility. Show today's class lineup in the lobby, run motivational content on the cardio floor, and promote personal training packages — all managed from one dashboard.",
  heroImageSrc: "/images/landing/mockup-v2-wellness-lobby.webp",
  heroImageAlt: "Welcome screen in a wellness studio lobby with natural light and plants",
};

export default async function GymsPage() {
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
