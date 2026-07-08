import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrowserDeviceClientId, getBrowserIanaTimezone } from "./device-id";
import {
  clearPlayerRegistration,
  persistRegistration,
  removePlayerStorage,
  playerStorageKeys,
} from "./device-storage";
import { ensureAnonymousPlayerSession, getPlayerSupabaseClient } from "./player-supabase";
import type { RegisterDeviceResult } from "./playback-types";

export async function registerOrRestoreDevice(): Promise<RegisterDeviceResult> {
  await ensureAnonymousPlayerSession();
  const supabase = getPlayerSupabaseClient();
  const clientId = getBrowserDeviceClientId();
  const timezone = getBrowserIanaTimezone();

  const { data, error } = await supabase.rpc("register_or_restore_device", {
    p_android_id: clientId,
    p_timezone: timezone,
    p_platform: "browser",
  });

  if (error) {
    throw error;
  }

  const result = data as RegisterDeviceResult;
  removePlayerStorage(playerStorageKeys.playbackSecret);
  persistRegistration(result.device_id, result.pairing_code);
  return result;
}

export async function fetchDeviceRow(
  supabase: SupabaseClient,
  deviceId: string,
): Promise<{ owner_id: string | null; name: string | null } | null> {
  const { data, error } = await supabase
    .from("devices")
    .select("owner_id, name")
    .eq("id", deviceId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function pollUntilLinked(
  deviceId: string,
  onLinked: (deviceName: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const supabase = getPlayerSupabaseClient();

  while (!signal.aborted) {
    try {
      const row = await fetchDeviceRow(supabase, deviceId);
      if (!row) {
        clearPlayerRegistration();
        throw new Error("device_not_found");
      }
      if (row.owner_id) {
        onLinked(row.name?.trim() || "Display");
        return;
      }
    } catch (err) {
      if ((err as Error).message === "device_not_found") {
        throw err;
      }
    }

    await sleep(5_000, signal);
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}
