import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { DevicePresenceRow } from "@/lib/device-presence";

const DEBOUNCE_MS = 750;

const OWNER_FILTERED_TABLES = [
  "devices",
  "device_groups",
  "playlist_groups",
  "media_groups",
  "playlists",
  "media",
  "websites",
] as const;

/** Member / junction tables — no owner_id; RLS scopes events to the signed-in tenant. */
const UNFILTERED_TABLES = [
  "device_playlists",
  "device_group_members",
  "playlist_group_members",
  "media_group_members",
  "playlist_items",
] as const;

const PRESENCE_KEYS = new Set(["status", "last_seen"]);

function isPresenceOnlyDeviceUpdate(
  oldRow: Record<string, unknown> | undefined,
  newRow: Record<string, unknown>,
): boolean {
  if (!oldRow) return false;
  const keys = new Set([...Object.keys(oldRow), ...Object.keys(newRow)]);
  for (const key of keys) {
    if (PRESENCE_KEYS.has(key)) continue;
    if (oldRow[key] !== newRow[key]) return false;
  }
  return true;
}

type ConsoleDataRealtimeCallbacks = {
  onDataChange: () => void;
  onDevicePresencePatch: (row: DevicePresenceRow) => void;
};

/**
 * Subscribes to postgres changes for all console snapshot tables.
 * TV heartbeats only touch status/last_seen — those are patched in-place
 * instead of triggering a full pull.
 */
export function subscribeConsoleDataRealtime(
  supabase: SupabaseClient,
  accountOwnerId: string,
  callbacks: ConsoleDataRealtimeCallbacks,
): { channel: RealtimeChannel; dispose: () => void } {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleDataChange = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      callbacks.onDataChange();
    }, DEBOUNCE_MS);
  };

  const ownerFilter = `owner_id=eq.${accountOwnerId}`;
  let channel = supabase.channel(`console-data:${accountOwnerId}`);

  for (const table of OWNER_FILTERED_TABLES) {
    for (const event of ["INSERT", "UPDATE", "DELETE"] as const) {
      channel = channel.on(
        "postgres_changes",
        { event, schema: "public", table, filter: ownerFilter },
        (payload) => {
          if (table === "devices" && event === "UPDATE") {
            const oldRow = payload.old as Record<string, unknown> | undefined;
            const newRow = payload.new as Record<string, unknown>;
            if (isPresenceOnlyDeviceUpdate(oldRow, newRow)) {
              const row = payload.new as { id?: string; status?: string; last_seen?: string | null };
              if (row.id && row.status) {
                callbacks.onDevicePresencePatch({
                  id: row.id,
                  status: row.status as DevicePresenceRow["status"],
                  last_seen: row.last_seen ?? null,
                });
              }
              return;
            }
          }
          scheduleDataChange();
        },
      );
    }
  }

  for (const table of UNFILTERED_TABLES) {
    for (const event of ["INSERT", "UPDATE", "DELETE"] as const) {
      channel = channel.on(
        "postgres_changes",
        { event, schema: "public", table },
        () => scheduleDataChange(),
      );
    }
  }

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      scheduleDataChange();
    }
  });

  const dispose = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    void supabase.removeChannel(channel);
  };

  return { channel, dispose };
}
