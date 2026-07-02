import type { PlanTemplate } from "@signage/types";
import { buildStaticPlanViewModels, mapTemplateToViewModel, type PlanViewModel } from "@/components/plans/plan-data";
import { getRequestPlanCurrency, type PlanCurrency } from "@/lib/plan-currency";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function loadActivePlanCatalog(countryHeader: string | null): Promise<{
  plans: PlanViewModel[];
  currency: PlanCurrency;
}> {
  const currency = getRequestPlanCurrency(countryHeader);
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_active_plans");

  const plans =
    error || !data || data.length === 0
      ? buildStaticPlanViewModels(currency)
      : (data as PlanTemplate[]).map((template) => mapTemplateToViewModel(template, currency));

  return { plans, currency };
}
