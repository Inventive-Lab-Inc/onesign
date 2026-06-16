import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Device,
  DeviceGroup,
  Media,
  MediaGroup,
  Playlist,
  PlaylistGroup,
  PlaylistItemWebsite,
  PlaylistItemWithMedia,
  Website,
} from "@signage/types";

export type DeviceWithAssignments = Device & {
  device_playlists: Array<{ playlist_id: string; is_active: boolean; updated_at?: string }> | null;
};

type RawPlaylistItemRow = {
  id: string;
  playlist_id: string;
  media_id: string | null;
  website_id?: string | null;
  sort_order: number;
  duration_seconds: number | null;
  display_from: string | null;
  display_until: string | null;
  created_at: string;
  daily_schedule_enabled?: boolean;
  daily_schedule?: PlaylistItemWithMedia["daily_schedule"] | null;
  media: NonNullable<PlaylistItemWithMedia["media"]> | NonNullable<PlaylistItemWithMedia["media"]>[] | null;
  websites: PlaylistItemWebsite | PlaylistItemWebsite[] | null;
};

function mapMediaPlaylistItemRow(row: RawPlaylistItemRow): PlaylistItemWithMedia | null {
  if (!row.media_id) return null;
  const mediaField = row.media;
  const media = Array.isArray(mediaField) ? mediaField[0] : mediaField;
  if (!media) {
    return null;
  }
  return {
    id: row.id,
    playlist_id: row.playlist_id,
    media_id: row.media_id,
    website_id: null,
    sort_order: row.sort_order,
    duration_seconds: row.duration_seconds,
    display_from: row.display_from,
    display_until: row.display_until,
    created_at: row.created_at,
    daily_schedule_enabled: row.daily_schedule_enabled ?? false,
    daily_schedule: row.daily_schedule ?? null,
    media,
    website: null,
  };
}

function mapWebsitePlaylistItemRow(row: RawPlaylistItemRow): PlaylistItemWithMedia | null {
  if (!row.website_id) return null;
  const websiteField = row.websites;
  const website = Array.isArray(websiteField) ? websiteField[0] : websiteField;
  if (!website) {
    return null;
  }
  return {
    id: row.id,
    playlist_id: row.playlist_id,
    media_id: null,
    website_id: row.website_id,
    sort_order: row.sort_order,
    duration_seconds: row.duration_seconds,
    display_from: row.display_from,
    display_until: row.display_until,
    created_at: row.created_at,
    daily_schedule_enabled: row.daily_schedule_enabled ?? false,
    daily_schedule: row.daily_schedule ?? null,
    media: null,
    website,
  };
}

export type DeviceGroupWithMembers = DeviceGroup & {
  member_device_ids: string[];
};

export type PlaylistGroupWithMembers = PlaylistGroup & {
  member_playlist_ids: string[];
};

export type MediaGroupWithMembers = MediaGroup & {
  member_media_ids: string[];
};

export type ConsoleSnapshot = {
  devices: DeviceWithAssignments[];
  deviceGroups: DeviceGroupWithMembers[];
  playlistGroups: PlaylistGroupWithMembers[];
  mediaGroups: MediaGroupWithMembers[];
  playlists: Playlist[];
  media: Media[];
  websites: Website[];
  playlistItemsByPlaylistId: Record<string, PlaylistItemWithMedia[]>;
  websitePlaylistRefCounts: Record<string, number>;
};

/**
 * Single bulk pull from Supabase (devices, playlists, media, all playlist items for those playlists).
 */
export async function pullConsoleData(supabase: SupabaseClient, userId: string): Promise<ConsoleSnapshot> {
  const [devicesRes, deviceGroupsRes, playlistGroupsRes, mediaGroupsRes, playlistsRes, mediaRes, websitesRes] = await Promise.all([
    supabase
      .from("devices")
      .select("*, device_playlists(playlist_id,is_active,updated_at)")
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
    supabase
      .from("media_groups")
      .select("*, media_group_members(media_id)")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true }),
    supabase.from("playlists").select("*").eq("owner_id", userId).order("created_at", { ascending: false }),
    supabase.from("media").select("*").eq("owner_id", userId).order("created_at", { ascending: false }),
    supabase.from("websites").select("*").eq("owner_id", userId).order("created_at", { ascending: false }),
  ]);

  if (devicesRes.error) throw new Error(`devices: ${devicesRes.error.message}`);
  if (deviceGroupsRes.error) throw new Error(`device_groups: ${deviceGroupsRes.error.message}`);
  if (playlistGroupsRes.error) throw new Error(`playlist_groups: ${playlistGroupsRes.error.message}`);
  if (mediaGroupsRes.error) throw new Error(`media_groups: ${mediaGroupsRes.error.message}`);
  if (playlistsRes.error) throw new Error(`playlists: ${playlistsRes.error.message}`);
  if (mediaRes.error) throw new Error(`media: ${mediaRes.error.message}`);
  if (websitesRes.error) throw new Error(`websites: ${websitesRes.error.message}`);

  const devices = (devicesRes.data as DeviceWithAssignments[]) ?? [];
  const deviceGroups = mapDeviceGroups(deviceGroupsRes.data);
  const playlistGroups = mapPlaylistGroups(playlistGroupsRes.data);
  const mediaGroups = mapMediaGroups(mediaGroupsRes.data);
  const playlists = (playlistsRes.data as Playlist[]) ?? [];
  const media = (mediaRes.data as Media[]) ?? [];
  const websites = (websitesRes.data as Website[]) ?? [];

  const playlistIds = playlists.map((p) => p.id);
  const playlistItemsByPlaylistId: Record<string, PlaylistItemWithMedia[]> = {};
  const websitePlaylistRefCounts: Record<string, number> = {};

  if (playlistIds.length > 0) {
    const { data: itemRows, error: itemsError } = await supabase
      .from("playlist_items")
      .select(
        "id,playlist_id,media_id,website_id,sort_order,duration_seconds,display_from,display_until,daily_schedule_enabled,daily_schedule,created_at,media(*),websites(*)",
      )
      .in("playlist_id", playlistIds)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (itemsError) throw itemsError;
    const rows = (itemRows as RawPlaylistItemRow[] | null) ?? [];
    for (const row of rows) {
      const mapped = row.website_id ? mapWebsitePlaylistItemRow(row) : mapMediaPlaylistItemRow(row);
      if (!mapped) continue;
      if (row.website_id) {
        websitePlaylistRefCounts[row.website_id] = (websitePlaylistRefCounts[row.website_id] ?? 0) + 1;
      }
      const list = playlistItemsByPlaylistId[mapped.playlist_id] ?? [];
      list.push(mapped);
      playlistItemsByPlaylistId[mapped.playlist_id] = list;
    }
  }

  return {
    devices,
    deviceGroups,
    playlistGroups,
    mediaGroups,
    playlists,
    media,
    websites,
    playlistItemsByPlaylistId,
    websitePlaylistRefCounts,
  };
}

type RawMediaGroupRow = MediaGroup & {
  media_group_members: Array<{ media_id: string }> | null;
};

function mapMediaGroups(rows: RawMediaGroupRow[] | null): MediaGroupWithMembers[] {
  return (rows ?? []).map((row) => {
    const members = row.media_group_members ?? [];
    return {
      id: row.id,
      owner_id: row.owner_id,
      name: row.name,
      accent_color: row.accent_color,
      parent_id: row.parent_id ?? null,
      created_at: row.created_at,
      member_media_ids: members.map((m) => m.media_id),
    };
  });
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
      playlist_id: row.playlist_id,
      created_at: row.created_at,
      member_device_ids: members.map((m) => m.device_id),
    };
  });
}
