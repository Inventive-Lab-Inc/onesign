import type { CSSProperties } from "react";
import type { DeviceScreenOrientation } from "@signage/types";
import {
  DEVICE_SCREEN_ORIENTATION_ROTATION,
  normalizeDeviceScreenOrientation,
} from "@/lib/device-screen-orientation";

export function normalizePlaybackScreenOrientation(
  value: string | null | undefined,
): DeviceScreenOrientation {
  return normalizeDeviceScreenOrientation(value ?? undefined);
}

/** CSS viewport rotation when Screen Orientation API lock is unavailable (desktop browsers). */
export function browserPlayerViewportStyle(
  orientation: DeviceScreenOrientation,
): CSSProperties {
  const rotation = DEVICE_SCREEN_ORIENTATION_ROTATION[orientation];
  if (rotation === 0) {
    return {
      width: "100%",
      height: "100%",
    };
  }

  const swapped = rotation === 90 || rotation === 270;

  return {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: swapped ? "100vh" : "100%",
    height: swapped ? "100vw" : "100%",
    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
    transformOrigin: "center center",
  };
}

type BrowserOrientationLock =
  | "any"
  | "natural"
  | "landscape"
  | "portrait"
  | "portrait-primary"
  | "portrait-secondary"
  | "landscape-primary"
  | "landscape-secondary";

type ScreenOrientationWithLock = ScreenOrientation & {
  lock?: (orientation: BrowserOrientationLock) => Promise<void>;
  unlock?: () => void;
};

function browserScreenOrientation(): ScreenOrientationWithLock | null {
  if (typeof screen === "undefined") return null;
  return screen.orientation as ScreenOrientationWithLock;
}

function orientationLockType(
  orientation: DeviceScreenOrientation,
): BrowserOrientationLock | null {
  switch (orientation) {
    case "portrait":
      return "portrait-primary";
    case "reverse_landscape":
      return "landscape-secondary";
    case "reverse_portrait":
      return "portrait-secondary";
    case "landscape":
      return "landscape-primary";
    default:
      return null;
  }
}

/** Best-effort lock like Android TV requestedOrientation; requires fullscreen on many browsers. */
export async function lockBrowserScreenOrientation(
  orientation: DeviceScreenOrientation,
): Promise<boolean> {
  const screenOrientation = browserScreenOrientation();
  if (!screenOrientation?.lock) {
    return false;
  }

  const lockType = orientationLockType(orientation);
  if (!lockType) return false;

  try {
    await screenOrientation.lock(lockType);
    return true;
  } catch {
    return false;
  }
}

export async function unlockBrowserScreenOrientation(): Promise<void> {
  try {
    browserScreenOrientation()?.unlock?.();
  } catch {
    // ignore
  }
}
