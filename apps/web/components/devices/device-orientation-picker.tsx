"use client";

import type { DeviceScreenOrientation } from "@signage/types";
import {
  DEVICE_SCREEN_ORIENTATION_LABELS,
  DEVICE_SCREEN_ORIENTATIONS,
} from "@/lib/device-screen-orientation";
import { DeviceScreenOrientationIcon } from "@/components/devices/device-screen-orientation-icon";
import { cn } from "@/lib/utils";

export function DeviceOrientationPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: DeviceScreenOrientation;
  onChange: (orientation: DeviceScreenOrientation) => void;
  disabled?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-brand-softest/40">
      {DEVICE_SCREEN_ORIENTATIONS.map((orientation, index) => {
        const selected = value === orientation;
        return (
          <button
            key={orientation}
            type="button"
            disabled={disabled}
            onClick={() => onChange(orientation)}
            className={cn(
              "flex w-full items-center gap-2.5 px-4 py-3 text-sm font-medium transition-colors",
              index > 0 && "border-t border-border/70",
              selected ? "bg-brand-softest text-primary" : "text-primary hover:bg-brand-softest/70",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <DeviceScreenOrientationIcon orientation={orientation} className="h-4 w-4" />
            {DEVICE_SCREEN_ORIENTATION_LABELS[orientation]}
          </button>
        );
      })}
    </div>
  );
}
