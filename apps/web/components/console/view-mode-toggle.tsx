"use client";

import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "grid" | "list";

type ViewModeToggleProps = {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  className?: string;
};

export function ViewModeToggle({ view, onViewChange, className }: ViewModeToggleProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5",
        className,
      )}
      role="group"
      aria-label="View mode"
    >
      <button
        type="button"
        onClick={() => onViewChange("grid")}
        className={cn(
          "rounded-md p-1.5 transition-colors",
          view === "grid"
            ? "bg-brand-soft text-brand-strong shadow-sm dark:text-brand-onDark"
            : "text-muted-foreground hover:text-foreground",
        )}
        aria-pressed={view === "grid"}
        aria-label="Grid view"
      >
        <LayoutGrid className="h-4 w-4" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={() => onViewChange("list")}
        className={cn(
          "rounded-md p-1.5 transition-colors",
          view === "list"
            ? "bg-brand-soft text-brand-strong shadow-sm dark:text-brand-onDark"
            : "text-muted-foreground hover:text-foreground",
        )}
        aria-pressed={view === "list"}
        aria-label="List view"
      >
        <List className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}
