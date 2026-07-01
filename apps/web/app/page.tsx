import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { PlanTemplate } from "@signage/types";
import { LandingPage } from "@/components/landing/landing-page";
import { buildStaticPlanViewModels, mapTemplateToViewModel } from "@/components/plans/plan-data";
import { getServerAuth } from "@/lib/supabase/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getRequestPlanCurrency } from "@/lib/plan-currency";
import { appUrl, isMarketingHost, normalizeHost } from "@/lib/site-hosts";

export default async function HomePage() {
  const host = headers().get("host");
  const { user } = await getServerAuth();

  const showLanding =
    isMarketingHost(host) ||
    (process.env.NODE_ENV === "development" && normalizeHost(host) === "localhost");

  if (showLanding) {
    if (user) redirect(appUrl("/dashboard"));

    const currency = getRequestPlanCurrency(headers().get("x-vercel-ip-country"));
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.rpc("list_active_plans");
    const plans =
      error || !data || data.length === 0
        ? buildStaticPlanViewModels(currency)
        : (data as PlanTemplate[]).map((template) => mapTemplateToViewModel(template, currency));

    return <LandingPage plans={plans} currency={currency} />;
  }

  redirect(user ? "/dashboard" : "/login");
}
