import { headers } from "next/headers";
import type { PlanTemplate } from "@signage/types";
import { PlansView } from "@/components/plans/plans-view";
import { buildStaticPlanViewModels, mapTemplateToViewModel } from "@/components/plans/plan-data";
import { getRequestPlanCurrency } from "@/lib/plan-currency";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function PlansPage() {
  const currency = getRequestPlanCurrency(headers().get("x-vercel-ip-country"));
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_active_plans");

  const plans =
    error || !data || data.length === 0
      ? buildStaticPlanViewModels(currency)
      : (data as PlanTemplate[]).map((template) => mapTemplateToViewModel(template, currency));

  return <PlansView plans={plans} currency={currency} />;
}
