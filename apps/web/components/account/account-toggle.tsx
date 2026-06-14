"use client";

import { cn } from "@/lib/utils";

export function AccountToggle({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "account-toggle-track inline-flex h-[1.375rem] w-9 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-faint30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        checked ? "bg-brand" : "bg-muted-foreground/30",
      )}
      data-state={checked ? "checked" : "unchecked"}
    >
      <span
        className={cn(
          "account-toggle-thumb pointer-events-none block h-4 w-4 shrink-0 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out",
          checked ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}
