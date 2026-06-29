import type { PlanTemplate } from "@signage/types";
import { PlansView } from "@/components/plans/plans-view";
import { STATIC_PLAN_VIEW_MODELS, mapTemplateToViewModel } from "@/components/plans/plan-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function PlansPage() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_active_plans");

  const plans =
    error || !data || data.length === 0
      ? STATIC_PLAN_VIEW_MODELS
      : (data as PlanTemplate[]).map(mapTemplateToViewModel);

  return <PlansView plans={plans} />;
}
