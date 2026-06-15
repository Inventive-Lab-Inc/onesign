import type { Media } from "@signage/types";

export function formatMediaAge(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 30) return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (day > 0) return day === 1 ? "yesterday" : `${day} days ago`;
  if (hr > 0) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  if (min > 0) return `${min} min ago`;
  return "just now";
}

export function inferMediaOrientation(item: Media): "landscape" | "portrait" | null {
  const name = (item.original_filename ?? item.storage_path).toLowerCase();
  if (name.includes("portrait") || name.includes("vertical")) return "portrait";
  if (name.includes("landscape") || name.includes("horizontal")) return "landscape";
  return null;
}

export function formatMediaMeta(item: Media): string {
  const typeLabel = item.file_type === "image" ? "Image" : item.file_type === "video" ? "Video" : "File";
  const orientation = inferMediaOrientation(item);
  const age = formatMediaAge(item.created_at);
  return orientation ? `${typeLabel} · ${orientation} · ${age}` : `${typeLabel} · ${age}`;
}

export function formatVideoDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function formatMediaFileSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"] as const;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = unitIndex === 0 ? 0 : value >= 10 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

export function formatStorageTotal(bytes: number): string {
  return formatMediaFileSize(bytes).replace(" ", "");
}

export type MediaTypeFilter = "all" | "image" | "video" | "unknown";
export type MediaOrientationFilter = "all" | "landscape" | "portrait";
export type MediaDateFilter = "all" | "week" | "month" | "year";
export type MediaSort = "newest" | "oldest" | "name-asc" | "name-desc";

export type FileManagementSort =
  | "title-asc"
  | "title-desc"
  | "type-asc"
  | "type-desc"
  | "uploaded-asc"
  | "uploaded-desc"
  | "size-asc"
  | "size-desc";

export function applyMediaTypeFilter(list: Media[], typeFilter: MediaTypeFilter): Media[] {
  if (typeFilter === "all") return list;
  return list.filter((m) => m.file_type === typeFilter);
}

export function applyMediaOrientationFilter(list: Media[], orientationFilter: MediaOrientationFilter): Media[] {
  if (orientationFilter === "all") return list;
  return list.filter((m) => inferMediaOrientation(m) === orientationFilter);
}

export function applyMediaDateFilter(list: Media[], dateFilter: MediaDateFilter): Media[] {
  if (dateFilter === "all") return list;
  const now = Date.now();
  const cutoffs: Record<Exclude<MediaDateFilter, "all">, number> = {
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
  };
  const cutoffMs = cutoffs[dateFilter];
  return list.filter((m) => now - new Date(m.created_at).getTime() <= cutoffMs);
}

export function applyMediaSearchFilter(list: Media[], query: string): Media[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((m) => (m.original_filename ?? m.storage_path).toLowerCase().includes(q));
}

export function applyMediaFilters(
  list: Media[],
  typeFilter: MediaTypeFilter,
  orientationFilter: MediaOrientationFilter,
  dateFilter: MediaDateFilter,
): Media[] {
  return applyMediaDateFilter(
    applyMediaOrientationFilter(applyMediaTypeFilter(list, typeFilter), orientationFilter),
    dateFilter,
  );
}

export function sortMediaList(list: Media[], sort: MediaSort): Media[] {
  const copy = [...list];
  switch (sort) {
    case "oldest":
      return copy.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    case "name-asc":
      return copy.sort((a, b) =>
        (a.original_filename ?? a.storage_path).localeCompare(b.original_filename ?? b.storage_path),
      );
    case "name-desc":
      return copy.sort((a, b) =>
        (b.original_filename ?? b.storage_path).localeCompare(a.original_filename ?? a.storage_path),
      );
    case "newest":
    default:
      return copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
}

export function sortMediaForFileManagement(list: Media[], sort: FileManagementSort): Media[] {
  const copy = [...list];
  switch (sort) {
    case "title-asc":
      return copy.sort((a, b) =>
        (a.original_filename ?? a.storage_path).localeCompare(b.original_filename ?? b.storage_path),
      );
    case "title-desc":
      return copy.sort((a, b) =>
        (b.original_filename ?? b.storage_path).localeCompare(a.original_filename ?? a.storage_path),
      );
    case "type-asc":
      return copy.sort((a, b) => a.file_type.localeCompare(b.file_type));
    case "type-desc":
      return copy.sort((a, b) => b.file_type.localeCompare(a.file_type));
    case "uploaded-asc":
      return copy.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    case "size-asc":
      return copy.sort((a, b) => (a.size_bytes ?? 0) - (b.size_bytes ?? 0));
    case "size-desc":
      return copy.sort((a, b) => (b.size_bytes ?? 0) - (a.size_bytes ?? 0));
    case "uploaded-desc":
    default:
      return copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
}
