"use client";

import type { DeviceScreenOrientation, DeviceStatus } from "@signage/types";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { DeviceScreenCardTvFrame } from "@/components/devices/device-screen-card-tv-frame";
import { mediaPublicUrl } from "@/lib/object-storage/urls";
import {
  DEVICE_THUMBNAIL_ACCEPT,
  MAX_DEVICE_THUMBNAIL_BYTES,
  removeDeviceThumbnail,
  uploadDeviceThumbnail,
} from "@/lib/upload-device-thumbnail";
import { cn } from "@/lib/utils";
import "./device-tv-frame.css";

function statusLabel(status: DeviceStatus): string {
  switch (status) {
    case "online":
      return "Online";
    case "offline":
      return "Offline";
    case "pending_pairing":
      return "Pending pairing";
    default:
      return status;
  }
}

export function ScreenStatusBadge({ status }: { status: DeviceStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        status === "online" && "bg-brand-soft text-brand-badge dark:text-brand-onDark",
        status === "offline" && "bg-muted text-muted-foreground",
        status === "pending_pairing" && "bg-amber-500/15 text-amber-900 dark:text-amber-200",
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

export function DeviceThumbnailPicker({
  deviceId,
  ownerId,
  thumbnailStoragePath,
  screenOrientation,
  canEdit = true,
  onUpdated,
  className,
  showFormatHint = true,
}: {
  deviceId: string;
  ownerId: string;
  thumbnailStoragePath?: string | null;
  screenOrientation?: DeviceScreenOrientation | string | null;
  canEdit?: boolean;
  onUpdated: (thumbnailStoragePath: string | null) => void;
  className?: string;
  showFormatHint?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const busy = uploading || removing;

  const handleFile = useCallback(
    async (file: File) => {
      if (!canEdit || busy) return;

      if (file.size > MAX_DEVICE_THUMBNAIL_BYTES) {
        toast.error(`Thumbnail must be ${Math.round(MAX_DEVICE_THUMBNAIL_BYTES / 1024 / 1024)} MB or smaller.`);
        return;
      }

      setUploading(true);
      try {
        const { thumbnailStoragePath: nextPath, error } = await uploadDeviceThumbnail(deviceId, ownerId, file);
        if (error || !nextPath) {
          toast.error(error ?? "Upload failed.");
          return;
        }
        onUpdated(nextPath);
        toast.success("Thumbnail updated");
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [busy, canEdit, deviceId, onUpdated, ownerId],
  );

  const handleRemove = useCallback(async () => {
    if (!canEdit || busy || !thumbnailStoragePath) return;

    setRemoving(true);
    try {
      const { error } = await removeDeviceThumbnail(deviceId, ownerId);
      if (error) {
        toast.error(error);
        return;
      }
      onUpdated(null);
      toast.success("Thumbnail removed");
    } finally {
      setRemoving(false);
    }
  }, [busy, canEdit, deviceId, onUpdated, ownerId, thumbnailStoragePath]);

  const thumbnailUrl = thumbnailStoragePath ? mediaPublicUrl(thumbnailStoragePath) : null;

  return (
    <div className={cn("flex w-full shrink-0 flex-col gap-2 sm:w-auto", className)}>
      <div
        className={cn(
          "group/thumb relative mx-auto h-24 w-36 shrink-0 overflow-hidden rounded-xl border border-border bg-muted/60 shadow-inner sm:mx-0",
          canEdit && !busy && "cursor-pointer",
        )}
      >
        {thumbnailUrl ? (
          <Image
            key={thumbnailStoragePath}
            src={thumbnailUrl}
            alt=""
            fill
            className="object-cover"
            sizes="144px"
            unoptimized
          />
        ) : (
          <div className="device-tv-frame-wrap device-tv-frame-wrap--tight">
            <DeviceScreenCardTvFrame orientation={screenOrientation} compact />
          </div>
        )}

        {canEdit ? (
          <>
            <button
              type="button"
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/45 text-white opacity-0 transition-opacity",
                !busy && "group-hover/thumb:opacity-100 group-focus-within/thumb:opacity-100",
                busy && "opacity-100",
              )}
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              aria-label="Edit thumbnail"
            >
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <>
                  <Pencil className="h-5 w-5" aria-hidden />
                  <span className="text-[0.6875rem] font-medium">Edit thumbnail</span>
                </>
              )}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={Object.keys(DEVICE_THUMBNAIL_ACCEPT).join(",")}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </>
        ) : null}
      </div>

      {canEdit && thumbnailUrl ? (
        <button
          type="button"
          className="mx-auto inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive sm:mx-0"
          onClick={() => void handleRemove()}
          disabled={busy}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Remove thumbnail
        </button>
      ) : canEdit && showFormatHint ? (
        <p className="mx-auto max-w-[9rem] text-center text-[0.6875rem] leading-snug text-muted-foreground sm:mx-0 sm:text-left">
          JPEG, PNG, or WebP · up to 2 MB
        </p>
      ) : null}
    </div>
  );
}
