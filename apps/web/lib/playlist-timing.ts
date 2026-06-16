import type { PlaylistItemWithMedia } from "@signage/types";
import { playlistItemIsWebsite } from "@/lib/playlist-item-display";

/** Row payload for inserting a playlist item (videos omit dwell; images default 10s). */
export function buildPlaylistItemInsertRow(params: {
  playlistId: string;
  mediaId: string;
  sortOrder: number;
  fileType?: string;
  durationSeconds?: number;
}): {
  playlist_id: string;
  media_id: string;
  sort_order: number;
  duration_seconds?: number;
} {
  const row = {
    playlist_id: params.playlistId,
    media_id: params.mediaId,
    sort_order: params.sortOrder,
  };
  if (params.fileType === "video") return row;
  return { ...row, duration_seconds: params.durationSeconds ?? 10 };
}

/** Seconds for timed summary; videos play in full and are counted separately. */
export function imageTimelineSeconds(item: PlaylistItemWithMedia): number {
  if (playlistItemIsWebsite(item)) {
    return Math.max(0, item.duration_seconds ?? 10);
  }
  if (item.media!.file_type === "video") return 0;
  return Math.max(0, item.duration_seconds ?? 10);
}

export function sumImageTimelineSeconds(items: PlaylistItemWithMedia[]): number {
  return items.reduce((acc, row) => acc + imageTimelineSeconds(row), 0);
}

/** AbleSign-style playlist summary, e.g. "1 Item • 10 Secs". */
export function formatAbleSignPlaylistSummary(items: PlaylistItemWithMedia[]): string {
  const count = items.length;
  const itemLabel = count === 1 ? "Item" : "Items";
  const imageSec = sumImageTimelineSeconds(items);
  const videos = items.filter((i) => !playlistItemIsWebsite(i) && i.media?.file_type === "video");
  if (videos.length === 0) {
    return `${count} ${itemLabel} • ${formatAbleSignSec(imageSec)}`;
  }
  const knownVideoSec = sumKnownVideoIntrinsicSeconds(items);
  const videoPart =
    knownVideoSec > 0
      ? `${videos.length} video${videos.length === 1 ? "" : "s"} (${formatAbleSignSec(Math.round(knownVideoSec))})`
      : `${videos.length} video${videos.length === 1 ? "" : "s"}`;
  return `${count} ${itemLabel} • ${formatAbleSignSec(imageSec)} · ${videoPart}`;
}

function formatAbleSignSec(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  return `${s} Sec${s === 1 ? "" : "s"}`;
}

function sumKnownVideoIntrinsicSeconds(items: PlaylistItemWithMedia[]): number {
  return items.reduce((acc, row) => {
    if (playlistItemIsWebsite(row) || !row.media) return acc;
    if (row.media.file_type !== "video") return acc;
    const d = row.media.duration_seconds;
    if (d == null || !Number.isFinite(d) || d <= 0) return acc;
    return acc + d;
  }, 0);
}

/** Badge text: image dwell totals plus video count (with known runtime when available). */
export function formatPlaylistClockLabel(items: PlaylistItemWithMedia[]): string {
  const imageSec = sumImageTimelineSeconds(items);
  const videos = items.filter((i) => !playlistItemIsWebsite(i) && i.media?.file_type === "video");
  const videoCount = videos.length;
  if (videoCount === 0) return formatAbleSignSec(imageSec);
  const knownVideoSec = sumKnownVideoIntrinsicSeconds(items);
  const videoPart =
    knownVideoSec > 0
      ? `${videoCount} video${videoCount === 1 ? "" : "s"} (${formatAbleSignSec(Math.round(knownVideoSec))})`
      : `${videoCount} video${videoCount === 1 ? "" : "s"}`;
  return `${formatAbleSignSec(imageSec)} · ${videoPart}`;
}
