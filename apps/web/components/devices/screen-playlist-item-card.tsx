"use client";

import type { PlaylistItemWithMedia } from "@signage/types";
import { Draggable } from "@hello-pangea/dnd";
import { FileImage, Globe } from "lucide-react";
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
import { PlaylistItemSavingOverlay } from "@/components/playlist/playlist-item-saving-overlay";

function ItemThumb({ item }: { item: PlaylistItemWithMedia }) {
  if (playlistItemIsWebsite(item)) {
    return (
      <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
        <WebsitePreviewFrame website={item.website!} className="pointer-events-none h-full w-full" />
        <span className="absolute bottom-0.5 right-0.5 inline-flex h-4 w-4 items-center justify-center rounded bg-black/70 text-white">
          <Globe className="h-2.5 w-2.5" aria-hidden />
        </span>
      </div>
    );
  }

  const url = mediaPublicUrl(item.media!.storage_path);
  return (
    <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
      {item.media!.file_type === "image" ? (
        <Image src={url} alt="" fill className="object-cover" sizes="64px" />
      ) : item.media!.file_type === "video" ? (
        <video className="h-full w-full object-cover" src={url} muted playsInline preload="metadata" />
      ) : (
        <div className="flex h-full items-center justify-center">
          <FileImage className="h-4 w-4 text-muted-foreground" />
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

  const cardBody = (
    <>
      <ItemThumb item={item} />
      <div className="min-w-0 flex-1 self-center leading-tight">
        <p className="truncate text-[0.8125rem] font-semibold text-foreground">{playlistItemTitle(item)}</p>
        <p className="mt-0.5 truncate text-[0.6875rem] capitalize text-muted-foreground">
          {formatPlaylistItemMeta(item)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5 self-center">
        {isVideo ? (
          <div className="flex items-center gap-1">
            <ReadonlyVideoDuration
              id={`duration-video-${item.draftKey}`}
              durationSeconds={item.media!.duration_seconds}
              fallbackProbeUrl={mediaPublicUrl(item.media!.storage_path)}
              onProbedDuration={(sec) => onVideoDurationProbed?.(item.media!.id, sec)}
              className="h-7 w-10 px-0.5 text-center text-xs"
            />
            <span className="shrink-0 text-[0.6875rem] text-muted-foreground">s</span>
          </div>
        ) : (
          <PlaylistDurationField
            id={`duration-${item.draftKey}`}
            seconds={item.duration_seconds}
            disabled={readOnly || item.isPending}
            onChange={(seconds) => onDurationChange(item.draftKey, seconds)}
          />
        )}
        {!readOnly ? (
          <ItemActionMenu
            ariaLabel={`Actions for ${playlistItemTitle(item)}`}
            items={menuItems}
          />
        ) : null}
      </div>
    </>
  );

  if (readOnly) {
    return (
      <div className="flex cursor-default items-center gap-2 rounded-lg border border-border bg-background p-2 shadow-sm">
        {cardBody}
      </div>
    );
  }

  return (
    <Draggable draggableId={`pi-${item.draftKey}`} index={index} isDragDisabled={item.isPending}>
      {(dragProvided, snapshot) => (
        <div
          ref={dragProvided.innerRef}
          {...dragProvided.draggableProps}
          {...dragProvided.dragHandleProps}
          className={cn(
            "relative flex items-center gap-2 rounded-lg border border-border bg-background p-2 shadow-sm",
            snapshot.isDragging && "ring-2 ring-brand-faint30",
            item.isPending && "border-brand/30",
          )}
        >
          {cardBody}
          {item.isPending ? <PlaylistItemSavingOverlay /> : null}
        </div>
      )}
    </Draggable>
  );
}
