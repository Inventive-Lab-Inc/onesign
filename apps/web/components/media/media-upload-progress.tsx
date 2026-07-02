"use client";

import type { MediaUploadProgress } from "@/lib/upload-media";
import { cn } from "@/lib/utils";

export function formatMediaUploadLabel(progress: MediaUploadProgress): string {
  const pct = progress.overallPercent;
  if (progress.totalFiles > 1) {
    return `Uploading ${progress.currentFileIndex + 1} of ${progress.totalFiles} (${pct}%)`;
  }
  if (pct >= 100) {
    return "Finishing upload…";
  }
  return `Uploading (${pct}%)`;
}

export function formatMediaUploadDetail(progress: MediaUploadProgress): string {
  if (progress.totalFiles > 1) {
    return `${progress.currentFileName} — ${progress.overallPercent}%`;
  }
  return progress.currentFileName;
}

export function MediaUploadProgressBar({
  progress,
  className,
  compact = false,
}: {
  progress: MediaUploadProgress;
  className?: string;
  compact?: boolean;
}) {
  const label = formatMediaUploadLabel(progress);
  const detail = formatMediaUploadDetail(progress);

  return (
    <div
      className={cn("space-y-2", className)}
      role="status"
      aria-live="polite"
      aria-label={`${label}. ${detail}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("font-medium text-foreground", compact ? "text-xs" : "text-sm")}>{label}</p>
          {!compact ? (
            <p className="truncate text-xs text-muted-foreground">{progress.currentFileName}</p>
          ) : null}
        </div>
        <span
          className={cn(
            "shrink-0 font-semibold tabular-nums text-brand-foreground-strong",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {progress.overallPercent}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-brand-soft/40">
        <div
          className="h-full rounded-full bg-brand-strong transition-[width] duration-150 ease-out"
          style={{ width: `${Math.max(progress.overallPercent, progress.overallPercent > 0 ? 4 : 0)}%` }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.overallPercent}
          aria-label={label}
        />
      </div>
    </div>
  );
}
