import type { DeviceScreenOrientation } from "@signage/types";

export const DEVICE_SCREEN_ORIENTATIONS: DeviceScreenOrientation[] = [
  "landscape",
  "portrait",
  "reverse_landscape",
  "reverse_portrait",
];

export const DEVICE_SCREEN_ORIENTATION_LABELS: Record<DeviceScreenOrientation, string> = {
  landscape: "Landscape",
  portrait: "Portrait (+90 Degrees)",
  reverse_landscape: "Upside Down (+180 Degrees)",
  reverse_portrait: "Reverse Portrait (+270 Degrees)",
};

/** Clockwise rotation for a landscape-default TV glyph. */
export const DEVICE_SCREEN_ORIENTATION_ROTATION: Record<DeviceScreenOrientation, number> = {
  landscape: 0,
  portrait: 90,
  reverse_landscape: 180,
  reverse_portrait: 270,
};

export function normalizeDeviceScreenOrientation(value: string | undefined): DeviceScreenOrientation {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === "portrait" ||
    normalized === "reverse_landscape" ||
    normalized === "reverse_portrait"
  ) {
    return normalized;
  }
  return "landscape";
}

export function formatDeviceScreenOrientationSubtitle(orientation: DeviceScreenOrientation): string {
  switch (orientation) {
    case "portrait":
      return "Portrait orientation";
    case "reverse_landscape":
      return "Upside down orientation";
    case "reverse_portrait":
      return "Reverse portrait orientation";
    default:
      return "Landscape orientation";
  }
}

export function orientationIsPortrait(orientation: DeviceScreenOrientation): boolean {
  return orientation === "portrait" || orientation === "reverse_portrait";
}

/** Preview frame size: swaps telemetry px when panel orientation differs from configured screen orientation. */
export function resolvePreviewFrameDimensions(
  displayPx: { widthPx: number; heightPx: number } | null,
  orientation: DeviceScreenOrientation = "landscape",
): { aspectW: number; aspectH: number; displayLabel: string | null } {
  const isPortrait = orientationIsPortrait(orientation);

  if (displayPx) {
    let { widthPx: width, heightPx: height } = displayPx;
    const shouldSwap = (width > height) !== !isPortrait;
    if (shouldSwap) {
      [width, height] = [height, width];
    }
    return {
      aspectW: width,
      aspectH: height,
      displayLabel: `${width} × ${height} px`,
    };
  }

  return {
    aspectW: isPortrait ? 9 : 16,
    aspectH: isPortrait ? 16 : 9,
    displayLabel: null,
  };
}

export function defaultDeviceScreenOrientationFilters(): Set<DeviceScreenOrientation> {
  return new Set(DEVICE_SCREEN_ORIENTATIONS);
}
