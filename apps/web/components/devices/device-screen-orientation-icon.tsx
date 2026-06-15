"use client";

import type { DeviceScreenOrientation } from "@signage/types";
import { Tv } from "lucide-react";
import { DEVICE_SCREEN_ORIENTATION_ROTATION } from "@/lib/device-screen-orientation";
import { cn } from "@/lib/utils";

export function DeviceScreenOrientationIcon({
  orientation,
  className,
  iconClassName,
}: {
  orientation: DeviceScreenOrientation;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span className={cn("inline-flex h-4 w-4 shrink-0 items-center justify-center", className)} aria-hidden>
      <Tv
        className={cn("h-3.5 w-3.5", iconClassName)}
        style={{ transform: `rotate(${DEVICE_SCREEN_ORIENTATION_ROTATION[orientation]}deg)` }}
      />
    </span>
  );
}
