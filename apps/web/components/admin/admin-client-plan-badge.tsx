import type { AdminUserDirectoryEntry, PlanTemplate } from "@signage/types";
import { Monitor, Sparkles } from "lucide-react";
import { resolveClientPlanBadge } from "@/lib/admin/client-plan-label";
import { cn } from "@/lib/utils";

const toneStyles = {
  trial: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
  catalog: "border-brand/20 bg-brand-soft text-brand-badge dark:text-brand-onDark",
  custom: "border-border bg-muted/50 text-muted-foreground",
  free: "border-border bg-muted/40 text-muted-foreground",
  expired: "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
} as const;

export function AdminClientPlanBadge({
  row,
  plans,
}: {
  row: Pick<
    AdminUserDirectoryEntry,
    | "device_limit"
    | "storage_limit_bytes"
    | "trial_ends_at"
    | "trial_expired"
    | "plan_kind"
    | "active_device_count"
  >;
  plans: PlanTemplate[];
}) {
  const badge = resolveClientPlanBadge(row, plans);
  const activeScreens = row.active_device_count ?? 0;

  return (
    <div className="flex flex-col items-start gap-1.5">
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold",
          toneStyles[badge.tone],
        )}
      >
        {badge.tone === "trial" ? (
          <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
        ) : null}
        {badge.label}
      </span>
      <span className="inline-flex items-center gap-1 text-[0.6875rem] text-muted-foreground">
        <Monitor className="h-3 w-3 shrink-0" aria-hidden />
        <span className="tabular-nums">
          {activeScreens} active
        </span>
      </span>
    </div>
  );
}
