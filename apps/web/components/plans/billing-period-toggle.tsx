"use client";

import { cn } from "@/lib/utils";
import type { BillingPeriod } from "./plan-data";

export function BillingPeriodToggle({
  value,
  onChange,
  className,
}: {
  value: BillingPeriod;
  onChange: (value: BillingPeriod) => void;
  className?: string;
}) {
  return (
    <fieldset
      aria-label="Billing period"
      className={cn(
        "mx-auto grid w-fit grid-cols-2 gap-x-1 rounded-full bg-muted p-1 text-center text-sm font-semibold",
        className,
      )}
    >
      {(
        [
          { id: "monthly" as const, label: "Monthly" },
          { id: "annual" as const, label: "Annual", hint: "Save ~20%" },
        ] as const
      ).map((option) => {
        const active = value === option.id;
        return (
          <label
            key={option.id}
            className={cn(
              "cursor-pointer rounded-full px-5 py-1.5 transition-colors sm:px-6",
              active ? "bg-brand text-brand-contrast shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <input
              type="radio"
              name="billing-period"
              value={option.id}
              checked={active}
              onChange={() => onChange(option.id)}
              className="sr-only"
            />
            {option.label}
            {"hint" in option && option.hint ? (
              <span className={cn("ml-1.5 text-xs font-medium", active ? "text-brand-contrast/90" : "opacity-80")}>
                {option.hint}
              </span>
            ) : null}
          </label>
        );
      })}
    </fieldset>
  );
}
