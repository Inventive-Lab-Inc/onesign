import type { AdminUserDirectoryEntry, PlanTemplate } from "@signage/types";

export type ClientPlanBadgeTone = "trial" | "catalog" | "custom" | "free" | "expired";

export interface ClientPlanBadgeInfo {
  label: string;
  tone: ClientPlanBadgeTone;
}

function findMatchingCatalogPlan(
  plans: PlanTemplate[],
  row: Pick<AdminUserDirectoryEntry, "device_limit" | "storage_limit_bytes">,
): PlanTemplate | undefined {
  return plans.find(
    (plan) =>
      plan.device_limit === row.device_limit &&
      plan.storage_limit_bytes === row.storage_limit_bytes,
  );
}

export function resolveClientPlanBadge(
  row: Pick<
    AdminUserDirectoryEntry,
    "device_limit" | "storage_limit_bytes" | "trial_ends_at" | "trial_expired" | "plan_kind"
  >,
  plans: PlanTemplate[],
): ClientPlanBadgeInfo {
  if (row.trial_ends_at) {
    if (row.trial_expired) {
      return { label: "Trial expired", tone: "expired" };
    }
    const solo = findMatchingCatalogPlan(plans, row);
    return { label: solo ? `${solo.name} trial` : "Trial", tone: "trial" };
  }

  if (row.plan_kind === "free") {
    return { label: "Free", tone: "free" };
  }

  const catalogMatch = findMatchingCatalogPlan(plans, row);
  if (catalogMatch) {
    return { label: catalogMatch.name, tone: "catalog" };
  }

  if (row.plan_kind === "custom") {
    return { label: "Custom", tone: "custom" };
  }

  return { label: "Active", tone: "catalog" };
}

export function guessClientPlanSelection(
  row: Pick<
    AdminUserDirectoryEntry,
    "device_limit" | "storage_limit_bytes" | "trial_ends_at" | "trial_expired" | "plan_kind"
  >,
  plans: PlanTemplate[],
  trialValue: string,
  customValue: string,
): string {
  if (row.trial_ends_at && !row.trial_expired) {
    return trialValue;
  }

  const catalogMatch = findMatchingCatalogPlan(plans, row);
  if (catalogMatch) {
    return catalogMatch.id;
  }

  if (row.plan_kind === "custom" || !catalogMatch) {
    return customValue;
  }

  return plans[0]?.id ?? customValue;
}
