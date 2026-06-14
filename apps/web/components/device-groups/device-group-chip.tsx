"use client";

import { cn } from "@/lib/utils";
import { resolveGroupColor } from "@/lib/device-group-colors";

export function DeviceGroupChip({
  name,
  accentColor,
  className,
}: {
  name: string;
  accentColor?: string | null;
  className?: string;
}) {
  const color = resolveGroupColor(accentColor);
  return (
    <span
      className={cn("device-group-chip truncate", className)}
      style={{ "--group-accent": color } as React.CSSProperties}
      title={name}
    >
      <span className="device-group-chip__dot" aria-hidden />
      <span className="truncate">{name}</span>
    </span>
  );
}
