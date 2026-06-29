import type { Media } from "@signage/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeviceWithAssignments } from "@/lib/console-sync";
import { ensureMediaVideoDuration } from "@/lib/media";
import { buildPlaylistItemInsertRow } from "@/lib/playlist-timing";
import { scopedContentRow } from "@/lib/workspace/content-scope";
import { friendlySupabaseError } from "@/lib/workspace/error-messages";

export async function ensureScreenPlaylistWorkspace(
  supabase: SupabaseClient,
  playlistId: string,
  workspaceId: string | null | undefined,
): Promise<{ error: string | null }> {
  if (!workspaceId) return { error: null };

  const { data, error: fetchError } = await supabase
    .from("playlists")
    .select("workspace_id")
    .eq("id", playlistId)
    .maybeSingle();

  if (fetchError) {
    return { error: friendlySupabaseError(fetchError.message, "Unable to load playlist.") };
  }
  if (!data || data.workspace_id) {
    return { error: null };
  }

  const { error } = await supabase
    .from("playlists")
    .update({ workspace_id: workspaceId })
    .eq("id", playlistId)
    .is("workspace_id", null);

  if (error) {
    return { error: friendlySupabaseError(error.message, "Unable to update playlist workspace.") };
  }

  return { error: null };
}

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
    const workspaceError = await ensureScreenPlaylistWorkspace(supabase, existing, device.workspace_id);
    if (workspaceError.error) {
      return { playlistId: null, error: workspaceError.error };
    }
    return { playlistId: existing, error: null };
  }

  const { data, error } = await supabase
    .from("playlists")
    .insert(
      scopedContentRow(ownerId, device.workspace_id, {
        name: `${device.name} — screen`,
      }),
    )
    .select("id")
    .single();

  if (error || !data?.id) {
    return {
      playlistId: null,
      error: friendlySupabaseError(error?.message, "Unable to create playlist"),
    };
  }

  const assignError = await assignPlaylistToDevice(supabase, device.id, data.id);
  if (assignError) {
    return { playlistId: null, error: friendlySupabaseError(assignError) };
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
    return { error: friendlySupabaseError(error.message) };
  }
  if (!data?.length) {
    return { error: null };
  }

  const updates = data.map((row, index) =>
    supabase.from("playlist_items").update({ sort_order: index }).eq("id", row.id),
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  return failed?.error ? { error: friendlySupabaseError(failed.error.message) } : { error: null };
}

export async function appendMediaToPlaylist(
  supabase: SupabaseClient,
  playlistId: string,
  media: Media,
  sortOrder: number,
  durationSeconds?: number,
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
      durationSeconds,
    }),
  );

  if (error) {
    return { error: friendlySupabaseError(error.message) };
  }

  return { error: null };
}
