"use client";

import type { DeviceScreenOrientation, PlaylistItemWithMedia } from "@signage/types";
import { Eye, ListVideo, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { WebsitePreviewFrame } from "@/components/websites/website-preview-frame";
import { playbackScheduleIsActive } from "@/lib/media-schedule";
import { mediaPublicUrl } from "@/lib/object-storage/urls";
import { playlistItemIsWebsite, playlistItemTitle } from "@/lib/playlist-item-display";
import {
  formatDeviceScreenOrientationSubtitle,
  normalizeDeviceScreenOrientation,
  orientationIsPortrait,
  resolvePreviewFrameDimensions,
} from "@/lib/device-screen-orientation";
import { cn } from "@/lib/utils";

function slideDurationSec(item: PlaylistItemWithMedia): number {
  return Math.max(1, item.duration_seconds ?? 10);
}

function playlistItemScheduleIsActive(item: PlaylistItemWithMedia, at: Date = new Date()): boolean {
  if (playlistItemIsWebsite(item)) {
    return playbackScheduleIsActive(item.website!, at);
  }
  if (!item.media) return false;
  return playbackScheduleIsActive(item.media, at);
}

function playlistItemIsPreviewable(item: PlaylistItemWithMedia): boolean {
  return playlistItemIsWebsite(item) || item.media != null;
}

function PreviewSlide({
  item,
  onImageDone,
  onVideoDone,
}: {
  item: PlaylistItemWithMedia;
  onImageDone: () => void;
  onVideoDone: () => void;
}) {
  const isWebsite = playlistItemIsWebsite(item);
  const media = item.media;
  const fileType = media?.file_type;
  const url = media?.storage_path ? mediaPublicUrl(media.storage_path) : null;
  const isVideo = !isWebsite && fileType === "video";
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoDoneRef = useRef(false);

  useEffect(() => {
    videoDoneRef.current = false;
  }, [item.id, url]);

  useEffect(() => {
    if (isWebsite || isVideo || !url) return;
    const ms = slideDurationSec(item) * 1000;
    const id = window.setTimeout(onImageDone, ms);
    return () => clearTimeout(id);
  }, [isWebsite, isVideo, item, onImageDone, url]);

  useEffect(() => {
    if (!isWebsite) return;
    const ms = slideDurationSec(item) * 1000;
    const id = window.setTimeout(onImageDone, ms);
    return () => clearTimeout(id);
  }, [isWebsite, item, onImageDone]);

  useEffect(() => {
    if (!isVideo || !url) return;
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    el.playsInline = true;
    el.src = url;
    void el.play().catch(() => {});
  }, [isVideo, url]);

  useEffect(() => {
    if (!isVideo || !url) return;
    const el = videoRef.current;
    if (!el) return;

    const finish = () => {
      if (videoDoneRef.current) return;
      videoDoneRef.current = true;
      onVideoDone();
    };

    el.addEventListener("ended", finish);
    return () => el.removeEventListener("ended", finish);
  }, [isVideo, onVideoDone, url]);

  if (isWebsite) {
    return (
      <WebsitePreviewFrame
        website={item.website!}
        zoomLevel={item.website!.zoom_level}
        className="h-full w-full bg-white"
      />
    );
  }

  if (!media || !url) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted px-4 text-center text-sm text-muted-foreground">
        Preview unavailable for this item.
      </div>
    );
  }

  if (isVideo) {
    return (
      <video
        ref={videoRef}
        className="h-full w-full object-contain bg-black"
        muted
        playsInline
        preload="auto"
        aria-label={`Preview: ${media.original_filename ?? "video"}`}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- MinIO public URL
    <img src={url} alt="" className="h-full w-full object-contain bg-black" />
  );
}

export type PlaylistPreviewFrameContext =
  /** Playlist-only editor — generic 16:9 frame. */
  | { kind: "playlist" }
  /** Screen editor — match TV aspect ratio and configured orientation when available. */
  | {
      kind: "device";
      displayPx: { widthPx: number; heightPx: number } | null;
      orientation?: DeviceScreenOrientation;
    };

const GENERIC_ASPECT = { w: 16, h: 9 } as const;

function buildPreviewHelpText(
  frame: PlaylistPreviewFrameContext,
  orientation: DeviceScreenOrientation,
  displayLabel: string | null,
): string {
  const timing = "Images use your durations; videos play in full.";
  const nav = "Arrow keys to change slides.";

  if (frame.kind === "playlist") {
    return `Runs in playlist order. ${timing} Generic 16:9 frame. ${nav}`;
  }

  const orient = formatDeviceScreenOrientationSubtitle(orientation).toLowerCase();
  if (displayLabel) {
    return `Runs in playlist order. ${timing} Frame matches this screen — ${orient}, ${displayLabel}. ${nav}`;
  }

  const ratio = orientationIsPortrait(orientation) ? "9:16" : "16:9";
  return `Runs in playlist order. ${timing} ${ratio} frame (${orient}); display size not reported yet. ${nav}`;
}

export function PlaylistPreviewButton({
  items,
  playlistName,
  className,
  frame = { kind: "playlist" },
  /** Icon-only control (e.g. dashboard table); same preview modal as the default trigger. */
  iconOnly = false,
  label = "Preview",
  icon: TriggerIcon = ListVideo,
}: {
  items: PlaylistItemWithMedia[];
  playlistName?: string | null;
  className?: string;
  /** Where the preview is opened from — device page uses TV-reported resolution when available. */
  frame?: PlaylistPreviewFrameContext;
  iconOnly?: boolean;
  label?: string;
  icon?: LucideIcon;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const [index, setIndex] = useState(0);

  const scheduledItems = useMemo(
    () => items.filter((entry) => playlistItemIsPreviewable(entry) && playlistItemScheduleIsActive(entry)),
    [items],
  );

  const empty = scheduledItems.length === 0;

  useEffect(() => {
    if (!open) return;
    setIndex(0);
  }, [open, scheduledItems.length]);

  const advance = useCallback(() => {
    setIndex((i) => (i + 1) % scheduledItems.length);
  }, [scheduledItems.length]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowRight") advance();
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + scheduledItems.length) % scheduledItems.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, advance, scheduledItems.length]);

  const item = scheduledItems[index];
  const slideLabel =
    scheduledItems.length > 0 ? `${index + 1} / ${scheduledItems.length}` : "";

  const deviceOrientation =
    frame.kind === "device"
      ? normalizeDeviceScreenOrientation(frame.orientation)
      : "landscape";
  const displayPx = frame.kind === "device" ? frame.displayPx : null;
  const previewFrame =
    frame.kind === "device"
      ? resolvePreviewFrameDimensions(displayPx, deviceOrientation)
      : { aspectW: GENERIC_ASPECT.w, aspectH: GENERIC_ASPECT.h, displayLabel: null };
  const aspectW = previewFrame.aspectW;
  const aspectH = previewFrame.aspectH;
  /** Width÷height — used so the frame fits inside the modal for both portrait and landscape TVs. */
  const aspectRatioNumber = aspectW / aspectH;
  const previewHelpText = buildPreviewHelpText(frame, deviceOrientation, previewFrame.displayLabel);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          "shrink-0",
          iconOnly ? "h-9 w-9 gap-0 p-0" : "gap-1.5",
          /* Keep hit target when disabled so clicks do not pass through to links behind (e.g. dashboard table). */
          empty && "!pointer-events-auto cursor-not-allowed",
          className,
        )}
        disabled={empty}
        title={empty ? "Add clips to the playlist to preview" : iconOnly ? "Preview playlist" : undefined}
        onClick={() => setOpen(true)}
        aria-label={iconOnly ? "Preview playlist" : `${label} playlist`}
      >
        <TriggerIcon
          className={cn(iconOnly ? "h-[1.125rem] w-[1.125rem]" : "h-4 w-4")}
          strokeWidth={2}
          aria-hidden
        />
        {!iconOnly ? label : null}
      </Button>
      {open && !empty && item ? (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Dismiss" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 flex max-h-[min(90vh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-muted/30 px-5 py-4">
              <div className="min-w-0 space-y-0.5">
                <h2 id={titleId} className="text-lg font-semibold text-foreground">
                  Playlist preview
                </h2>
                {playlistName ? (
                  <p className="truncate text-sm text-muted-foreground">{playlistName}</p>
                ) : null}
              </div>
              <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-3">
              <p className="text-xs leading-relaxed text-muted-foreground">{previewHelpText}</p>
              <div className="flex w-full justify-center">
                <div
                  className="mx-auto overflow-hidden rounded-lg border border-border bg-muted/20"
                  style={{
                    width: `min(100%, calc(min(65vh, 560px) * ${aspectRatioNumber}))`,
                    aspectRatio: `${aspectW} / ${aspectH}`,
                  }}
                >
                  <PreviewSlide
                    key={`${item.id}-${index}`}
                    item={item}
                    onImageDone={advance}
                    onVideoDone={advance}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">
                  Slide <span className="font-medium tabular-nums text-foreground">{slideLabel}</span>
                </span>
                <span className="truncate text-xs text-muted-foreground max-w-[min(100%,240px)]" title={playlistItemTitle(item)}>
                  {playlistItemTitle(item)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
