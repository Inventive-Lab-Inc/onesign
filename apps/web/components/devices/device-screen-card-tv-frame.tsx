import type { DeviceScreenOrientation } from "@signage/types";
import {
  DEVICE_SCREEN_ORIENTATION_ROTATION,
  normalizeDeviceScreenOrientation,
} from "@/lib/device-screen-orientation";
import { cn } from "@/lib/utils";
import "./device-tv-frame.css";

type DeviceScreenCardTvFrameProps = {
  className?: string;
  /** Thinner bezel — sizing still fills the parent container. */
  compact?: boolean;
  orientation?: DeviceScreenOrientation | string | null;
};

/** TV frame that scales to fit its container (use inside `.device-tv-frame-wrap`). */
export function DeviceScreenCardTvFrame({
  className,
  compact = false,
  orientation: orientationProp,
}: DeviceScreenCardTvFrameProps) {
  const orientation = normalizeDeviceScreenOrientation(orientationProp ?? undefined);
  const rotation = DEVICE_SCREEN_ORIENTATION_ROTATION[orientation];
  const isSideways = rotation === 90 || rotation === 270;

  return (
    <div
      className={cn(
        "device-tv-frame",
        compact && "device-tv-frame--compact",
        isSideways && "device-tv-frame--sideways",
        className,
      )}
      style={{ transform: rotation ? `rotate(${rotation}deg)` : undefined }}
      aria-hidden
    >
      <div className="device-tv-frame__panel">
        <div className="device-tv-frame__screen" />
      </div>
      <div className="device-tv-frame__stand" />
    </div>
  );
}
