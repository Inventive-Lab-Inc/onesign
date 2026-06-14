import type { SupabaseClient } from "@supabase/supabase-js";
import type { Device, DeviceGroup, Media, Playlist, PlaylistGroup, PlaylistItemWithMedia } from "@signage/types";

export type DeviceWithAssignments = Device & {
  device_playlists: Array<{ playlist_id: string; is_active: boolean }> | null;
};

type RawPlaylistItemRow = {
  id: string;
  playlist_id: string;
  media_id: string;
  sort_order: number;
  duration_seconds: number | null;
  display_from: string | null;
  display_until: string | null;
  created_at: string;
  media: PlaylistItemWithMedia["media"] | PlaylistItemWithMedia["media"][];
};

function mapPlaylistItemRow(row: RawPlaylistItemRow): PlaylistItemWithMedia {
  const mediaField = row.media;
  const media = Array.isArray(mediaField) ? mediaField[0] : mediaField;
  if (!media) {
    throw new Error("Playlist item is missing joined media metadata.");
  }
  return {
    id: row.id,
    playlist_id: row.playlist_id,
    media_id: row.media_id,
    sort_order: row.sort_order,
    duration_seconds: row.duration_seconds,
    display_from: row.display_from,
    display_until: row.display_until,
    created_at: row.created_at,
    media,
  };
}

export type DeviceGroupWithMembers = DeviceGroup & {
  member_device_ids: string[];
};

export type PlaylistGroupWithMembers = PlaylistGroup & {
  member_playlist_ids: string[];
};

export type ConsoleSnapshot = {
  devices: DeviceWithAssignments[];
  deviceGroups: DeviceGroupWithMembers[];
  playlistGroups: PlaylistGroupWithMembers[];
  playlists: Playlist[];
  media: Media[];
  playlistItemsByPlaylistId: Record<string, PlaylistItemWithMedia[]>;
};

/**
 * Single bulk pull from Supabase (devices, playlists, media, all playlist items for those playlists).
 */
export async function pullConsoleData(supabase: SupabaseClient, userId: string): Promise<ConsoleSnapshot> {
  const { error: staleErr } = await supabase.rpc("mark_stale_devices_offline", { p_owner_id: userId });
  if (staleErr) {
    console.warn("[pullConsoleData] mark_stale_devices_offline:", staleErr.message);
  }

  const [devicesRes, deviceGroupsRes, playlistGroupsRes, playlistsRes, mediaRes] = await Promise.all([
    supabase
      .from("devices")
      .select("*, device_playlists(playlist_id,is_active)")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("device_groups")
      .select("*, device_group_members(device_id)")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("playlist_groups")
      .select("*, playlist_group_members(playlist_id)")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true }),
    supabase.from("playlists").select("*").eq("owner_id", userId).order("created_at", { ascending: false }),
    supabase.from("media").select("*").eq("owner_id", userId).order("created_at", { ascending: false }),
  ]);

  if (devicesRes.error) throw new Error(`devices: ${devicesRes.error.message}`);
  if (deviceGroupsRes.error) throw new Error(`device_groups: ${deviceGroupsRes.error.message}`);
  if (playlistGroupsRes.error) throw new Error(`playlist_groups: ${playlistGroupsRes.error.message}`);
  if (playlistsRes.error) throw new Error(`playlists: ${playlistsRes.error.message}`);
  if (mediaRes.error) throw new Error(`media: ${mediaRes.error.message}`);

  const devices = (devicesRes.data as DeviceWithAssignments[]) ?? [];
  const deviceGroups = mapDeviceGroups(deviceGroupsRes.data);
  const playlistGroups = mapPlaylistGroups(playlistGroupsRes.data);
  const playlists = (playlistsRes.data as Playlist[]) ?? [];
  const media = (mediaRes.data as Media[]) ?? [];

  const playlistIds = playlists.map((p) => p.id);
  const playlistItemsByPlaylistId: Record<string, PlaylistItemWithMedia[]> = {};

  if (playlistIds.length > 0) {
    const { data: itemRows, error: itemsError } = await supabase
      .from("playlist_items")
      .select(
        "id,playlist_id,media_id,sort_order,duration_seconds,display_from,display_until,created_at,media(*)",
      )
      .in("playlist_id", playlistIds)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (itemsError) throw itemsError;
    const rows = (itemRows as RawPlaylistItemRow[] | null) ?? [];
    for (const row of rows) {
      const mapped = mapPlaylistItemRow(row);
      const list = playlistItemsByPlaylistId[mapped.playlist_id] ?? [];
      list.push(mapped);
      playlistItemsByPlaylistId[mapped.playlist_id] = list;
    }
  }

  return { devices, deviceGroups, playlistGroups, playlists, media, playlistItemsByPlaylistId };
}

type RawPlaylistGroupRow = PlaylistGroup & {
  playlist_group_members: Array<{ playlist_id: string }> | null;
};

function mapPlaylistGroups(rows: RawPlaylistGroupRow[] | null): PlaylistGroupWithMembers[] {
  return (rows ?? []).map((row) => {
    const members = row.playlist_group_members ?? [];
    return {
      id: row.id,
      owner_id: row.owner_id,
      name: row.name,
      accent_color: row.accent_color,
      created_at: row.created_at,
      member_playlist_ids: members.map((m) => m.playlist_id),
    };
  });
}

type RawDeviceGroupRow = DeviceGroup & {
  device_group_members: Array<{ device_id: string }> | null;
};

function mapDeviceGroups(rows: RawDeviceGroupRow[] | null): DeviceGroupWithMembers[] {
  return (rows ?? []).map((row) => {
    const members = row.device_group_members ?? [];
    return {
      id: row.id,
      owner_id: row.owner_id,
      name: row.name,
      accent_color: row.accent_color,
      created_at: row.created_at,
      member_device_ids: members.map((m) => m.device_id),
    };
  });
}
