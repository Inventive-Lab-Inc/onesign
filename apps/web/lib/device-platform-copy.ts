import type { DevicePlatform } from "@signage/types";

/** Console label for how a screen connects (client app), not physical hardware. */
export function devicePlatformLabel(platform: DevicePlatform | null | undefined): string {
  return platform === "browser" ? "Browser player" : "Android TV app";
}

export function devicePlatformPairingHint(platform: DevicePlatform | null | undefined): string {
  if (platform === "browser") {
    return "Open the browser player at player.onesigntv.com — in any browser, including on Android phones. It shows as a Browser screen here, not the Android TV app.";
  }
  return "Open the OneSign TV app on the screen and enter the code shown on that device. Only the native app shows as Android in the console.";
}

/** Short reconnect steps for the console re-pair dialog. */
export function deviceReconnectSteps(platform: DevicePlatform | null | undefined): readonly string[] {
  if (platform === "browser") {
    return ["Open browser player", "Copy pairing code", "Enter below"] as const;
  }
  return ["Open OneSign TV", "Copy pairing code", "Enter below"] as const;
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
