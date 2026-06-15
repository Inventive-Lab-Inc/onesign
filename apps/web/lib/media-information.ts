import type { Media } from "@signage/types";
import {
  formatMediaAge,
  formatMediaFileSize,
  formatVideoDuration,
  inferMediaOrientation,
} from "@/lib/media-display";

function mediaTypeLabel(fileType: Media["file_type"]): string {
  if (fileType === "image") return "Image";
  if (fileType === "video") return "Video";
  return "File";
}

function formatOrientation(item: Media, dimensions: string | null): string {
  if (dimensions) {
    const match = dimensions.match(/^(\d+)×(\d+)$/);
    if (match) {
      const width = Number(match[1]);
      const height = Number(match[2]);
      if (width > height) return "Landscape";
      if (height > width) return "Portrait";
      return "Square";
    }
  }
  const inferred = inferMediaOrientation(item);
  if (inferred === "landscape") return "Landscape";
  if (inferred === "portrait") return "Portrait";
  return "—";
}

export function buildMediaInformationRows(
  item: Media,
  probedDimensions: string | null,
): { label: string; value: string }[] {
  const storedDimensions =
    item.width_pixels != null &&
    item.height_pixels != null &&
    item.width_pixels > 0 &&
    item.height_pixels > 0
      ? `${item.width_pixels}×${item.height_pixels}`
      : null;
  const dimensions = storedDimensions ?? probedDimensions;
  const rows: { label: string; value: string }[] = [
    { label: "Uploaded", value: formatMediaAge(item.created_at) },
    { label: "Type", value: mediaTypeLabel(item.file_type) },
    { label: "Size", value: formatMediaFileSize(item.size_bytes) },
    { label: "Orientation", value: formatOrientation(item, dimensions) },
  ];

  if (dimensions) {
    rows.push({ label: "Dimensions", value: dimensions });
  }

  const duration = item.file_type === "video" ? formatVideoDuration(item.duration_seconds) : null;
  if (duration) {
    rows.push({ label: "Duration", value: duration });
  }

  return rows;
}

export function mediaDisplayTitle(item: Media): string {
  return item.original_filename ?? item.storage_path;
}

export function normalizeMediaTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const trimmed = tag.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}
