"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
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
    onChange(Number.isFinite(n) && n > 0 ? Math.round(n) : 10);
  }

  if (readOnly) {
    return (
      <div className={cn("text-center text-sm tabular-nums text-foreground", className)}>
        {storedSeconds} Secs
      </div>
    );
  }

  return (
    <div className={cn("flex w-[5.5rem] flex-col items-center gap-1", className)}>
      <Label
        htmlFor={id}
        className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
      >
        Duration
      </Label>
      <div className="flex w-full items-center justify-end gap-1.5">
        <Input
          id={id}
          type="number"
          min={1}
          value={value}
          disabled={disabled}
          className="h-9 w-[3.25rem] px-1 text-center text-sm tabular-nums"
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => commit(value)}
        />
        <span className="shrink-0 text-sm text-muted-foreground">Secs</span>
      </div>
    </div>
  );
}
