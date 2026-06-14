import type { DeviceGroupWithMembers } from "@/lib/console-sync";

export type GroupFilter = "all" | "ungrouped" | string;

type GroupLike = { id: string; name?: string };

export function parseGroupFilterFromSearchParam(raw: string | null, groups: GroupLike[]): GroupFilter {
  if (!raw) return "all";
  if (raw === "ungrouped") return "ungrouped";
  if (groups.some((group) => group.id === raw)) return raw;
  return "all";
}

export function groupFilterLabel(filter: GroupFilter, activeGroup: GroupLike | null): string {
  if (filter === "ungrouped") return "Ungrouped";
  if (filter === "all") return "All items";
  return activeGroup?.name ?? "Group";
}
