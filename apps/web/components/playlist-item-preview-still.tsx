"use client";

import type { PlaylistItemWithMedia } from "@signage/types";
import { playlistItemIsWebsite } from "@/lib/playlist-item-display";
import { mediaPublicUrl } from "@/lib/object-storage/urls";
import { WebsitePreviewFrame } from "@/components/websites/website-preview-frame";
import { cn } from "@/lib/utils";

export function PlaylistItemPreviewStill({
  item,
  className,
  fit = "cover",
}: {
  item: PlaylistItemWithMedia;
  className?: string;
  fit?: "cover" | "contain";
}) {
  const fitClass = fit === "cover" ? "object-cover" : "object-contain";
  const isWebsite = playlistItemIsWebsite(item);
  const media = item.media;
  const url = media?.storage_path ? mediaPublicUrl(media.storage_path) : null;
  const isVideo = !isWebsite && media?.file_type === "video";

  if (isWebsite) {
    return (
      <WebsitePreviewFrame
        website={item.website!}
        zoomLevel={item.website!.zoom_level}
        className={cn("h-full w-full bg-white", className)}
      />
    );
  }

  if (!media || !url) {
    return null;
  }

  if (isVideo) {
    return (
      <video
        src={url}
        className={cn("h-full w-full bg-black", fitClass, className)}
        muted
        playsInline
        preload="metadata"
        aria-hidden
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- MinIO public URL
    <img src={url} alt="" className={cn("h-full w-full bg-black", fitClass, className)} />
  );
}
