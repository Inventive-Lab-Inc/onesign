"use client";

import type { Device } from "@signage/types";
import { useMemo } from "react";
import { deviceConnectionLabel, getDeviceConnectionState } from "@/lib/device-connection";
import { cn } from "@/lib/utils";

export function DeviceConnectionIndicator({
  device,
  className,
}: {
  device: Pick<Device, "status" | "last_seen" | "platform">;
  className?: string;
}) {
  const state = useMemo(() => getDeviceConnectionState(device), [device]);
  const label = deviceConnectionLabel(state);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        state === "connected" && "bg-brand-soft text-brand-badge dark:text-brand-onDark",
        state === "unreachable" && "bg-muted text-muted-foreground",
        state === "never_connected" && "bg-amber-500/15 text-amber-900 dark:text-amber-200",
        className,
      )}
    >
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          state === "connected" && "bg-green-500",
          state === "unreachable" && "bg-muted-foreground/50",
          state === "never_connected" && "bg-amber-500",
        )}
        aria-hidden
      />
      {label}
    </span>
  );
}
