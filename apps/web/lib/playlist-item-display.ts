import type { PlaylistItemWithMedia } from "@signage/types";
import { formatMediaAge } from "@/lib/media-display";

export function playlistItemIsWebsite(item: PlaylistItemWithMedia): boolean {
  return item.website_id != null && item.website != null;
}

export function playlistItemTitle(item: PlaylistItemWithMedia): string {
  if (playlistItemIsWebsite(item)) return item.website!.name;
  return item.media!.original_filename ?? item.media!.storage_path;
}

export function playlistItemKind(item: PlaylistItemWithMedia): "website" | "image" | "video" {
  if (playlistItemIsWebsite(item)) return "website";
  return item.media!.file_type as "image" | "video";
}

export function formatPlaylistItemMeta(item: PlaylistItemWithMedia): string {
  if (playlistItemIsWebsite(item)) {
    return `Website • ${formatMediaAge(item.website!.created_at)}`;
  }
  const type = item.media!.file_type;
  return `${type.charAt(0).toUpperCase()}${type.slice(1)} • ${formatMediaAge(item.created_at)}`;
}
