import type { Media } from "@signage/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeviceWithAssignments } from "@/lib/console-sync";
import { ensureMediaVideoDuration } from "@/lib/media";
import { buildPlaylistItemInsertRow } from "@/lib/playlist-timing";

export async function assignPlaylistToDevice(
  supabase: SupabaseClient,
  deviceId: string,
  playlistId: string,
): Promise<string | null> {
  const { error } = await supabase.from("device_playlists").upsert(
    {
      device_id: deviceId,
      playlist_id: playlistId,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "device_id,playlist_id" },
  );
  if (error) return error.message;

  const { error: deactivateError } = await supabase
    .from("device_playlists")
    .update({ is_active: false })
    .eq("device_id", deviceId)
    .neq("playlist_id", playlistId);
  if (deactivateError) return deactivateError.message;

  return null;
}

export async function ensureActivePlaylistForDevice(
  supabase: SupabaseClient,
  ownerId: string,
  device: DeviceWithAssignments,
): Promise<{ playlistId: string | null; error: string | null }> {
  const existing = device.device_playlists?.find((row) => row.is_active)?.playlist_id;
  if (existing) {
    return { playlistId: existing, error: null };
  }

  const { data, error } = await supabase
    .from("playlists")
    .insert({ owner_id: ownerId, name: `${device.name} — screen` })
    .select("id")
    .single();

  if (error || !data?.id) {
    return { playlistId: null, error: error?.message ?? "Unable to create playlist" };
  }

  const assignError = await assignPlaylistToDevice(supabase, device.id, data.id);
  if (assignError) {
    return { playlistId: null, error: assignError };
  }

  return { playlistId: data.id, error: null };
}

/** Reassign sort_order to 0..n-1 using the same order TVs use (sort_order, then id). */
export async function normalizePlaylistSortOrder(
  supabase: SupabaseClient,
  playlistId: string,
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from("playlist_items")
    .select("id")
    .eq("playlist_id", playlistId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return { error: error.message };
  }
  if (!data?.length) {
    return { error: null };
  }

  const updates = data.map((row, index) =>
    supabase.from("playlist_items").update({ sort_order: index }).eq("id", row.id),
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  return failed?.error ? { error: failed.error.message } : { error: null };
}

export async function appendMediaToPlaylist(
  supabase: SupabaseClient,
  playlistId: string,
  media: Media,
  sortOrder: number,
): Promise<{ error: string | null }> {
  if (media.file_type === "video") {
    await ensureMediaVideoDuration(supabase, media);
  }

  const { error } = await supabase.from("playlist_items").insert(
    buildPlaylistItemInsertRow({
      playlistId,
      mediaId: media.id,
      sortOrder,
      fileType: media.file_type,
    }),
  );

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}
