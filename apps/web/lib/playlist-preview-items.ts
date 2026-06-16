import type { PlaylistItemWithMedia } from "@signage/types";
import { playbackScheduleIsActive } from "@/lib/media-schedule";
import { playlistItemIsWebsite } from "@/lib/playlist-item-display";

export function playlistItemIsPreviewable(item: PlaylistItemWithMedia): boolean {
  return playlistItemIsWebsite(item) || item.media != null;
}

export function playlistItemScheduleIsActive(
  item: PlaylistItemWithMedia,
  at: Date = new Date(),
): boolean {
  if (playlistItemIsWebsite(item)) {
    return playbackScheduleIsActive(item.website!, at);
  }
  if (!item.media) return false;
  return playbackScheduleIsActive(item.media, at);
}

export function firstPreviewablePlaylistItem(
  items: PlaylistItemWithMedia[],
  at: Date = new Date(),
): PlaylistItemWithMedia | null {
  return (
    items.find(
      (item) => playlistItemIsPreviewable(item) && playlistItemScheduleIsActive(item, at),
    ) ?? null
  );
}
