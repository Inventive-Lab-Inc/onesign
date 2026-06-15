import type { Device } from "@signage/types";

export const DEVICE_LIVE_SCREENSHOT_FILENAME = "live.webp";

export const MAX_DEVICE_LIVE_SCREENSHOT_BYTES = 512 * 1024;

export function deviceLiveScreenshotObjectPath(ownerId: string, deviceId: string): string {
  return `${ownerId}/devices/${deviceId}/${DEVICE_LIVE_SCREENSHOT_FILENAME}`;
}

export async function requestDeviceLiveScreenshot(deviceId: string): Promise<{ error: string | null }> {
  const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("request_device_live_screenshot", { p_device_id: deviceId });
  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export type DeviceLiveScreenshotFields = Pick<
  Device,
  "id" | "owner_id" | "screenshot_requested_at" | "live_screenshot_at"
>;
