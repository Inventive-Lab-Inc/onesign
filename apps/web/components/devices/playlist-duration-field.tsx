"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function PlaylistDurationField({
  id,
  seconds,
  onChange,
  disabled = false,
  readOnly = false,
  className,
}: {
  id: string;
  seconds: number | null | undefined;
  onChange: (seconds: number) => void;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
}) {
  const storedSeconds = Math.max(1, seconds ?? 10);
  const [value, setValue] = useState(String(storedSeconds));

  useEffect(() => {
    setValue(String(Math.max(1, seconds ?? 10)));
  }, [seconds]);

  function commit(raw: string) {
    const n = Number(raw);
    const next = Number.isFinite(n) && n > 0 ? Math.round(n) : 10;
    setValue(String(next));
    onChange(next);
  }

  function adjust(delta: number) {
    const current = Number(value);
    const base = Number.isFinite(current) && current > 0 ? Math.round(current) : storedSeconds;
    const next = Math.max(1, base + delta);
    setValue(String(next));
    onChange(next);
  }

  if (readOnly) {
    return (
      <div className={cn("text-xs tabular-nums text-foreground", className)}>
        {storedSeconds}s
      </div>
    );
  }

  const parsed = Number(value);
  const canDecrease = Number.isFinite(parsed) ? parsed > 1 : storedSeconds > 1;

  const stepperButtonClass =
    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Label htmlFor={id} className="sr-only">
        Duration in seconds
      </Label>
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          disabled={disabled || !canDecrease}
          aria-label="Decrease duration"
          className={stepperButtonClass}
          onClick={() => adjust(-1)}
        >
          <Minus className="h-3 w-3" aria-hidden />
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          disabled={disabled}
          className="h-7 w-8 rounded-md border border-input bg-background px-0 text-center text-xs tabular-nums text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          onChange={(event) => setValue(event.target.value.replace(/\D/g, ""))}
          onBlur={() => commit(value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label="Increase duration"
          className={stepperButtonClass}
          onClick={() => adjust(1)}
        >
          <Plus className="h-3 w-3" aria-hidden />
        </button>
      </div>
      <span className="shrink-0 text-[0.6875rem] text-muted-foreground">s</span>
    </div>
  );
}
