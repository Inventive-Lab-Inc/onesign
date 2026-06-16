import type { SupabaseClient } from "@supabase/supabase-js";
import type { Media, PlaylistItemWithMedia } from "@signage/types";
import { buildPlaylistItemInsertRow } from "@/lib/playlist-timing";
import { ensureMediaVideoDuration } from "@/lib/media";

export type DraftPlaylistItem = PlaylistItemWithMedia & {
  draftKey: string;
  isPending?: boolean;
};

export function toDraftItems(items: PlaylistItemWithMedia[]): DraftPlaylistItem[] {
  return items.map((item) => ({ ...item, draftKey: item.id }));
}

export function draftItemSnapshot(items: DraftPlaylistItem[]): string {
  return JSON.stringify(
    items.map((item, index) => ({
      index,
      media_id: item.media_id,
      website_id: item.website_id,
      media_duration_seconds: item.media?.duration_seconds ?? null,
      duration_seconds: item.duration_seconds,
      display_from: item.display_from,
      display_until: item.display_until,
      daily_schedule_enabled: item.daily_schedule_enabled,
      daily_schedule: item.daily_schedule,
    })),
  );
}

export async function persistPlaylistDraft(
  supabase: SupabaseClient,
  playlistId: string,
  draftItems: DraftPlaylistItem[],
  baselineItems: PlaylistItemWithMedia[],
  allMedia: Media[],
): Promise<{ error: string | null }> {
  const baselineIds = new Set(baselineItems.map((item) => item.id));
  const draftPersistedIds = new Set(
    draftItems.filter((item) => !item.isPending).map((item) => item.id),
  );

  for (const id of baselineIds) {
    if (!draftPersistedIds.has(id)) {
      const { error } = await supabase.from("playlist_items").delete().eq("id", id);
      if (error) return { error: error.message };
    }
  }

  const resolvedItems: { draftKey: string; id: string }[] = [];

  for (let index = 0; index < draftItems.length; index += 1) {
    const item = draftItems[index];
    if (!item) continue;

    if (item.isPending) {
      if (item.website_id) {
        const { data, error } = await supabase
          .from("playlist_items")
          .insert({
            playlist_id: playlistId,
            website_id: item.website_id,
            sort_order: index,
            duration_seconds: item.duration_seconds ?? 30,
            display_from: item.display_from,
            display_until: item.display_until,
            daily_schedule_enabled: item.daily_schedule_enabled ?? false,
            daily_schedule: item.daily_schedule_enabled ? item.daily_schedule : null,
          })
          .select("id")
          .single();
        if (error || !data) return { error: error?.message ?? "Insert failed" };
        resolvedItems.push({ draftKey: item.draftKey, id: data.id });
      } else if (item.media_id) {
        const mediaRow = allMedia.find((m) => m.id === item.media_id);
        if (mediaRow?.file_type === "video") {
          await ensureMediaVideoDuration(supabase, mediaRow);
        }
        const { data, error } = await supabase
          .from("playlist_items")
          .insert(
            buildPlaylistItemInsertRow({
              playlistId,
              mediaId: item.media_id,
              sortOrder: index,
              fileType: mediaRow?.file_type,
              durationSeconds: item.duration_seconds ?? undefined,
            }),
          )
          .select("id")
          .single();
        if (error || !data) return { error: error?.message ?? "Insert failed" };
        resolvedItems.push({ draftKey: item.draftKey, id: data.id });
      }
      continue;
    }

    const { error: updateError } = await supabase
      .from("playlist_items")
      .update({
        sort_order: index,
        duration_seconds: item.duration_seconds,
        display_from: item.display_from,
        display_until: item.display_until,
        daily_schedule_enabled: item.daily_schedule_enabled ?? false,
        daily_schedule: item.daily_schedule_enabled ? item.daily_schedule : null,
      })
      .eq("id", item.id);
    if (updateError) return { error: updateError.message };
    resolvedItems.push({ draftKey: item.draftKey, id: item.id });
  }

  return { error: null };
}

export function createPendingMediaItem(
  media: Media,
  sortOrder: number,
): DraftPlaylistItem {
  const draftKey = `new-${crypto.randomUUID()}`;
  return {
    draftKey,
    id: draftKey,
    isPending: true,
    playlist_id: "",
    media_id: media.id,
    website_id: null,
    sort_order: sortOrder,
    duration_seconds: media.file_type === "video" ? null : 10,
    display_from: null,
    display_until: null,
    created_at: new Date().toISOString(),
    daily_schedule_enabled: false,
    daily_schedule: null,
    media: {
      id: media.id,
      storage_path: media.storage_path,
      file_type: media.file_type,
      original_filename: media.original_filename,
      duration_seconds: media.duration_seconds,
      display_from: media.display_from ?? null,
      display_until: media.display_until ?? null,
    },
    website: null,
  };
}

export function createPendingWebsiteItem(
  website: NonNullable<PlaylistItemWithMedia["website"]>,
  sortOrder: number,
): DraftPlaylistItem {
  const draftKey = `new-${crypto.randomUUID()}`;
  return {
    draftKey,
    id: draftKey,
    isPending: true,
    playlist_id: "",
    media_id: null,
    website_id: website.id,
    sort_order: sortOrder,
    duration_seconds: 30,
    display_from: null,
    display_until: null,
    created_at: website.created_at,
    daily_schedule_enabled: false,
    daily_schedule: null,
    media: null,
    website,
  };
}
