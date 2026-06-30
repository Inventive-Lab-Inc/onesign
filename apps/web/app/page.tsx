import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { PlanTemplate } from "@signage/types";
import { LandingPage } from "@/components/landing/landing-page";
import { STATIC_PLAN_VIEW_MODELS, mapTemplateToViewModel } from "@/components/plans/plan-data";
import { getServerAuth } from "@/lib/supabase/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { appUrl, isMarketingHost, normalizeHost } from "@/lib/site-hosts";

export default async function HomePage() {
  const host = headers().get("host");
  const { user } = await getServerAuth();

  const showLanding =
    isMarketingHost(host) ||
    (process.env.NODE_ENV === "development" && normalizeHost(host) === "localhost");

  if (showLanding) {
    if (user) redirect(appUrl("/dashboard"));

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.rpc("list_active_plans");
    const plans =
      error || !data || data.length === 0
        ? STATIC_PLAN_VIEW_MODELS
        : (data as PlanTemplate[]).map(mapTemplateToViewModel);

    return <LandingPage plans={plans} />;
  }

  redirect(user ? "/dashboard" : "/login");
}
