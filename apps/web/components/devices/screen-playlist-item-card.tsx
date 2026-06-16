"use client";

import type { PlaylistItemWithMedia } from "@signage/types";
import { Draggable } from "@hello-pangea/dnd";
import { FileImage, FileVideo, Globe } from "lucide-react";
import Image from "next/image";
import { PlaylistDurationField } from "@/components/devices/playlist-duration-field";
import { WebsitePreviewFrame } from "@/components/websites/website-preview-frame";
import { ItemActionMenu, type ActionMenuItem } from "@/components/console/item-action-menu";
import { ReadonlyVideoDuration } from "@/components/readonly-video-duration";
import {
  formatPlaylistItemMeta,
  playlistItemIsWebsite,
  playlistItemKind,
  playlistItemTitle,
} from "@/lib/playlist-item-display";
import { mediaPublicUrl } from "@/lib/object-storage/urls";
import { cn } from "@/lib/utils";
import type { DraftPlaylistItem } from "@/lib/persist-playlist-draft";

function ItemThumb({ item }: { item: PlaylistItemWithMedia }) {
  if (playlistItemIsWebsite(item)) {
    return (
      <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
        <WebsitePreviewFrame website={item.website!} className="pointer-events-none h-full w-full" />
        <span className="absolute bottom-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded bg-black/70 text-white">
          <Globe className="h-3 w-3" aria-hidden />
        </span>
      </div>
    );
  }

  const url = mediaPublicUrl(item.media!.storage_path);
  return (
    <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
      {item.media!.file_type === "image" ? (
        <Image src={url} alt="" fill className="object-cover" sizes="112px" />
      ) : item.media!.file_type === "video" ? (
        <video className="h-full w-full object-cover" src={url} muted playsInline preload="metadata" />
      ) : (
        <div className="flex h-full items-center justify-center">
          <FileImage className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

export function ScreenPlaylistItemCard({
  item,
  index,
  menuItems,
  onDurationChange,
  onVideoDurationProbed,
  readOnly = false,
}: {
  item: DraftPlaylistItem;
  index: number;
  menuItems: ActionMenuItem[];
  onDurationChange: (draftKey: string, seconds: number) => void;
  onVideoDurationProbed?: (mediaId: string, seconds: number) => void;
  readOnly?: boolean;
}) {
  const kind = playlistItemKind(item);
  const isVideo = kind === "video";

  return (
    <Draggable draggableId={`pi-${item.draftKey}`} index={index} isDragDisabled={readOnly}>
      {(dragProvided, snapshot) => (
        <div
          ref={dragProvided.innerRef}
          {...dragProvided.draggableProps}
          {...dragProvided.dragHandleProps}
          className={cn(
            "flex items-stretch gap-3 rounded-xl border border-border bg-background p-3 shadow-sm",
            snapshot.isDragging && "ring-2 ring-brand-faint30",
          )}
        >
          <ItemThumb item={item} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{playlistItemTitle(item)}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{formatPlaylistItemMeta(item)}</p>
            <div className="mt-1 flex items-center gap-1 text-xs capitalize text-muted-foreground">
              {kind === "video" ? (
                <FileVideo className="h-3.5 w-3.5" />
              ) : kind === "website" ? (
                <Globe className="h-3.5 w-3.5" />
              ) : null}
              <span>{kind}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-end gap-0.5">
            {isVideo ? (
              <div className="flex w-[5.5rem] flex-col items-center gap-1">
                <span className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Duration
                </span>
                <div className="flex w-full items-center justify-end gap-1.5">
                  <ReadonlyVideoDuration
                    id={`duration-video-${item.draftKey}`}
                    durationSeconds={item.media!.duration_seconds}
                    fallbackProbeUrl={mediaPublicUrl(item.media!.storage_path)}
                    onProbedDuration={(sec) => onVideoDurationProbed?.(item.media!.id, sec)}
                    className="h-9 w-[3.25rem] px-1 text-center"
                  />
                  <span className="shrink-0 text-sm text-muted-foreground">Secs</span>
                </div>
              </div>
            ) : (
              <PlaylistDurationField
                id={`duration-${item.draftKey}`}
                seconds={item.duration_seconds}
                disabled={readOnly}
                onChange={(seconds) => onDurationChange(item.draftKey, seconds)}
              />
            )}
            {!readOnly ? (
              <ItemActionMenu
                ariaLabel={`Actions for ${playlistItemTitle(item)}`}
                items={menuItems}
                className="mb-1.5"
              />
            ) : null}
          </div>
        </div>
      )}
    </Draggable>
  );
}
