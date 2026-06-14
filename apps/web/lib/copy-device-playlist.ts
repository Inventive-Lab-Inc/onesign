import type { PlaylistItemWithMedia } from "@signage/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeviceWithAssignments } from "@/lib/console-sync";
import { buildPlaylistItemInsertRow } from "@/lib/playlist-timing";
import { ensureActivePlaylistForDevice } from "@/lib/screen-playlist";

export async function clearDevicePlaylist(
  supabase: SupabaseClient,
  playlistId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("playlist_items").delete().eq("playlist_id", playlistId);
  return { error: error?.message ?? null };
}

export async function shuffleDevicePlaylist(
  supabase: SupabaseClient,
  items: PlaylistItemWithMedia[],
): Promise<{ error: string | null }> {
  if (items.length < 2) return { error: null };
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp;
  }
  const updates = shuffled.map((item, index) =>
    supabase.from("playlist_items").update({ sort_order: index }).eq("id", item.id),
  );
  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  return { error: failed?.error?.message ?? null };
}

export async function copyPlaylistToDevices(
  supabase: SupabaseClient,
  ownerId: string,
  sourceItems: PlaylistItemWithMedia[],
  targetDevices: DeviceWithAssignments[],
): Promise<{ copiedCount: number; error: string | null }> {
  let copiedCount = 0;

  for (const device of targetDevices) {
    const { playlistId, error: ensureError } = await ensureActivePlaylistForDevice(supabase, ownerId, device);
    if (ensureError || !playlistId) {
      return { copiedCount, error: ensureError ?? `Unable to prepare playlist for ${device.name}` };
    }

    const { error: clearError } = await clearDevicePlaylist(supabase, playlistId);
    if (clearError) {
      return { copiedCount, error: clearError };
    }

    if (sourceItems.length === 0) {
      copiedCount += 1;
      continue;
    }

    const rows = sourceItems.map((item, index) => {
      const base = buildPlaylistItemInsertRow({
        playlistId,
        mediaId: item.media_id,
        sortOrder: index,
        fileType: item.media.file_type,
      });
      if (item.media.file_type !== "video" && item.duration_seconds != null) {
        return { ...base, duration_seconds: item.duration_seconds };
      }
      return base;
    });

    const { error: insertError } = await supabase.from("playlist_items").insert(rows);
    if (insertError) {
      return { copiedCount, error: insertError.message };
    }

    copiedCount += 1;
  }

  return { copiedCount, error: null };
}
