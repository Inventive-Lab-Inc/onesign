import type { Device, DeviceStatus } from "@signage/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useConsoleDataStore } from "@/stores/console-data-store";

/** Default poll elsewhere in the console; device list/detail routes use [useDevicePageAutoSync] at 10s. */
export const PRESENCE_POLL_INTERVAL_MS = 25_000;

export type DevicePresenceRow = Pick<Device, "id" | "status" | "last_seen">;

/** Prefer the newest timestamp so out-of-order Realtime/poll rows cannot regress liveness. */
export function mergeDeviceLastSeen(
  existing: string | null | undefined,
  incoming: string | null | undefined,
): string | null {
  if (incoming == null || incoming === "") {
    return existing ?? null;
  }
  if (existing == null || existing === "") {
    return incoming;
  }
  return new Date(incoming).getTime() >= new Date(existing).getTime() ? incoming : existing;
}

/** Lightweight pull — only liveness fields (TV heartbeats update these every ~30s). */
export async function fetchDevicePresence(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<DevicePresenceRow[]> {
  const { data, error } = await supabase
    .from("devices")
    .select("id, status, last_seen")
    .eq("owner_id", ownerId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as DevicePresenceRow[];
}

export function applyDevicePresenceRows(rows: DevicePresenceRow[]): void {
  const { devices, patchDevice } = useConsoleDataStore.getState();
  for (const row of rows) {
    const existing = devices.find((device) => device.id === row.id);
    patchDevice(row.id, {
      status: row.status as DeviceStatus,
      last_seen: mergeDeviceLastSeen(existing?.last_seen, row.last_seen),
    });
  }
}

export function patchDevicePresenceFromRow(row: DevicePresenceRow): void {
  const { devices, patchDevice } = useConsoleDataStore.getState();
  const existing = devices.find((device) => device.id === row.id);
  patchDevice(row.id, {
    status: row.status as DeviceStatus,
    last_seen: mergeDeviceLastSeen(existing?.last_seen, row.last_seen),
  });
}
