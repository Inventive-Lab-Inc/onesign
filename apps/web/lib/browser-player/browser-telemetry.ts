import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrowserDeviceClientId, getBrowserIanaTimezone } from "./device-id";

export function buildBrowserTelemetryPayload(
  contentRevision: string | null,
  mediaCache: Record<string, unknown> | null,
): Record<string, unknown> {
  const screen = typeof window !== "undefined" ? window.screen : undefined;

  return {
    platform: "browser",
    player: "web",
    playerVersion: "1.0.0",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    language: typeof navigator !== "undefined" ? navigator.language : null,
    online: typeof navigator !== "undefined" ? navigator.onLine : null,
    timezone: getBrowserIanaTimezone(),
    settings_android_id: getBrowserDeviceClientId(),
    screenWidth: screen?.width ?? null,
    screenHeight: screen?.height ?? null,
    devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio : null,
    contentRevision,
    mediaCache,
  };
}

export async function reportBrowserTelemetry(
  supabase: SupabaseClient,
  deviceId: string,
  playbackSecret: string | null,
  contentRevision: string | null,
  mediaCache: Record<string, unknown> | null,
): Promise<void> {
  const payload = buildBrowserTelemetryPayload(contentRevision, mediaCache);
  await supabase.rpc("tv_device_report_telemetry", {
    p_device_id: deviceId,
    p_telemetry: payload,
    p_playback_secret: playbackSecret,
  });
}
