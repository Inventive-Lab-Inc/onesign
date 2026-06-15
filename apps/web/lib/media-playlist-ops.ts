import type { Media } from "@signage/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeviceWithAssignments } from "@/lib/console-sync";
import { appendMediaToPlaylist, ensureActivePlaylistForDevice } from "@/lib/screen-playlist";

export type AddMediaPlaylistPosition = "start" | "end";

export type AddMediaToPlaylistsOptions = {
  position: AddMediaPlaylistPosition;
  imageDurationSeconds: number;
};

export function countPlaylistReferences(
  playlistItemsByPlaylistId: Record<string, { media_id: string }[]>,
  mediaId: string,
): number {
  let count = 0;
  for (const items of Object.values(playlistItemsByPlaylistId)) {
    count += items.filter((item) => item.media_id === mediaId).length;
  }
  return count;
}

export async function removeMediaFromAllPlaylists(
  supabase: SupabaseClient,
  mediaId: string,
): Promise<{ removedCount: number; error: string | null }> {
  const { data, error: fetchError } = await supabase
    .from("playlist_items")
    .select("id")
    .eq("media_id", mediaId);

  if (fetchError) {
    return { removedCount: 0, error: fetchError.message };
  }

  if (!data?.length) {
    return { removedCount: 0, error: null };
  }

  const { error: deleteError } = await supabase.from("playlist_items").delete().eq("media_id", mediaId);
  if (deleteError) {
    return { removedCount: 0, error: deleteError.message };
  }

  return { removedCount: data.length, error: null };
}

async function shiftPlaylistSortOrders(
  supabase: SupabaseClient,
  playlistId: string,
  existingItems: { id: string; sort_order: number }[],
  offset: number,
): Promise<{ error: string | null }> {
  const sorted = [...existingItems].sort((a, b) => a.sort_order - b.sort_order);
  for (let index = 0; index < sorted.length; index += 1) {
    const item = sorted[index];
    if (!item) continue;
    const { error } = await supabase
      .from("playlist_items")
      .update({ sort_order: index + offset })
      .eq("id", item.id);
    if (error) {
      return { error: error.message };
    }
  }
  return { error: null };
}

export async function addMediaToDevicePlaylists(
  supabase: SupabaseClient,
  ownerId: string,
  mediaItems: Media[],
  devices: DeviceWithAssignments[],
  playlistItemsByPlaylistId: Record<string, { id: string; sort_order: number }[]>,
  options: AddMediaToPlaylistsOptions = { position: "end", imageDurationSeconds: 10 },
): Promise<{ addedCount: number; error: string | null }> {
  if (mediaItems.length === 0 || devices.length === 0) {
    return { addedCount: 0, error: null };
  }

  let addedCount = 0;

  for (const device of devices) {
    const { playlistId, error: ensureError } = await ensureActivePlaylistForDevice(supabase, ownerId, device);
    if (ensureError || !playlistId) {
      return { addedCount, error: ensureError ?? `Unable to prepare playlist for ${device.name}` };
    }

    const existingItems = playlistItemsByPlaylistId[playlistId] ?? [];

    if (options.position === "start") {
      const { error: shiftError } = await shiftPlaylistSortOrders(
        supabase,
        playlistId,
        existingItems,
        mediaItems.length,
      );
      if (shiftError) {
        return { addedCount, error: shiftError };
      }
    }

    const baseOrder = options.position === "start" ? 0 : existingItems.length;

    for (const [index, media] of mediaItems.entries()) {
      const durationSeconds = media.file_type === "image" ? options.imageDurationSeconds : undefined;
      const { error: appendError } = await appendMediaToPlaylist(
        supabase,
        playlistId,
        media,
        baseOrder + index,
        durationSeconds,
      );
      if (appendError) {
        return { addedCount, error: appendError };
      }
    }

    addedCount += 1;
  }

  return { addedCount, error: null };
}

export async function moveMediaToFolder(
  supabase: SupabaseClient,
  mediaId: string,
  targetGroupId: string | null,
): Promise<{ error: string | null }> {
  const { error: clearError } = await supabase.from("media_group_members").delete().eq("media_id", mediaId);
  if (clearError) {
    return { error: clearError.message };
  }

  if (!targetGroupId) {
    return { error: null };
  }

  const { error: insertError } = await supabase
    .from("media_group_members")
    .insert({ group_id: targetGroupId, media_id: mediaId });

  if (insertError) {
    return { error: insertError.message };
  }

  return { error: null };
}

export async function moveMediaBatchToFolder(
  supabase: SupabaseClient,
  mediaIds: string[],
  targetGroupId: string | null,
): Promise<{ error: string | null }> {
  for (const mediaId of mediaIds) {
    const { error } = await moveMediaToFolder(supabase, mediaId, targetGroupId);
    if (error) {
      return { error };
    }
  }
  return { error: null };
}
