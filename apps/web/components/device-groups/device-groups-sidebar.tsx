"use client";

import { FolderOpen, Layers, Plus, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveGroupColor } from "@/lib/device-group-colors";
import type { DeviceGroupWithMembers } from "@/lib/console-sync";
import { Button } from "@/components/ui/button";

export type GroupFilter = "all" | "ungrouped" | string;

type DeviceGroupsSidebarProps = {
  groups: DeviceGroupWithMembers[];
  activeFilter: GroupFilter;
  onFilterChange: (filter: GroupFilter) => void;
  ungroupedCount: number;
  totalCount: number;
  readOnly?: boolean;
  onCreateGroup: () => void;
  onEditGroup: (group: DeviceGroupWithMembers) => void;
};

export function DeviceGroupsSidebar({
  groups,
  activeFilter,
  onFilterChange,
  ungroupedCount,
  totalCount,
  readOnly = false,
  onCreateGroup,
  onEditGroup,
}: DeviceGroupsSidebarProps) {
  return (
    <nav className="rounded-xl border border-border bg-muted/30 p-2" aria-label="Filter by group">
      <div className="mb-2 flex items-center justify-between gap-2 px-2">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Groups</p>
        {!readOnly ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs font-semibold text-brand hover:text-brand-strong"
            onClick={onCreateGroup}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
            New
          </Button>
        ) : null}
      </div>

      <ul className="space-y-0.5">
        <GroupNavItem
          active={activeFilter === "all"}
          label="All screens"
          count={totalCount}
          icon={Layers}
          onClick={() => onFilterChange("all")}
        />
        <GroupNavItem
          active={activeFilter === "ungrouped"}
          label="Ungrouped"
          count={ungroupedCount}
          icon={FolderOpen}
          onClick={() => onFilterChange("ungrouped")}
        />
      </ul>

      {groups.length > 0 ? (
        <ul className="mt-2 space-y-0.5 border-t border-border/70 pt-2">
          {groups.map((group) => {
            const color = resolveGroupColor(group.accent_color);
            const active = activeFilter === group.id;
            return (
              <li key={group.id} className="group/item flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onFilterChange(group.id)}
                  className={cn(
                    "device-group-sidebar-item flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors",
                    active
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                  )}
                  data-active={active}
                  style={{ "--group-accent": color } as React.CSSProperties}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full ring-2 ring-background"
                    style={{ background: color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">{group.name}</span>
                  <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                    {group.member_device_ids.length}
                  </span>
                </button>
                {!readOnly ? (
                  <button
                    type="button"
                    onClick={() => onEditGroup(group)}
                    className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover/item:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Edit group ${group.name}`}
                  >
                    <Settings2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 border-t border-border/70 px-2 pt-3 text-[0.6875rem] leading-relaxed text-muted-foreground">
          Organize screens by location, floor, or venue. Create your first group above.
        </p>
      )}
    </nav>
  );
}

function GroupNavItem({
  active,
  label,
  count,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  icon: typeof Layers;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors",
          active
            ? "bg-card text-foreground shadow-sm ring-1 ring-border"
            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
        )}
      >
        <Icon className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{count}</span>
      </button>
    </li>
  );
}
