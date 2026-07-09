import type { DevicePlatform } from "@signage/types";

/** Console label for how a screen connects (client app), not physical hardware. */
export function devicePlatformLabel(platform: DevicePlatform | null | undefined): string {
  return platform === "browser" ? "Browser player" : "Android TV app";
}

export function devicePlatformPairingHint(platform: DevicePlatform | null | undefined): string {
  if (platform === "browser") {
    return "Open the browser player (player.onesigntv.com) and enter the code shown there.";
  }
  return "Open the OneSign TV app on the screen and enter the code shown on that device.";
}

export function parseRebindPlatformMismatch(
  message: string | null | undefined,
  hint: string | null | undefined,
): { screenPlatform: DevicePlatform; playerPlatform: DevicePlatform } | null {
  const normalized = message?.trim().toLowerCase();
  if (normalized !== "platform_mismatch") return null;

  const parts = hint?.split("->").map((part) => part.trim());
  if (parts?.length !== 2) return null;
  if (parts[0] !== "android" && parts[0] !== "browser") return null;
  if (parts[1] !== "android" && parts[1] !== "browser") return null;

  return {
    screenPlatform: parts[0],
    playerPlatform: parts[1],
  };
}
