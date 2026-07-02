import type { Device } from "@signage/types";

export type DeviceMediaCacheTelemetry = {
  items_total?: number;
  items_ready?: number;
  videos_total?: number;
  videos_ready?: number;
  images_total?: number;
  images_ready?: number;
  warming?: boolean;
  cache_bytes_used?: number;
  cache_bytes_max?: number;
  content_revision?: string;
};

function telemetryNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function telemetryBoolean(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  return null;
}

/** Parsed `telemetry.media_cache` from the TV app (Phase 3). */
export function getDeviceMediaCache(device: Device): DeviceMediaCacheTelemetry | null {
  const t = device.telemetry;
  if (!t || typeof t !== "object") return null;
  const raw = (t as Record<string, unknown>).media_cache;
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const itemsTotal = telemetryNumber(m.items_total);
  const itemsReady = telemetryNumber(m.items_ready);
  if (itemsTotal == null || itemsReady == null) return null;
  return {
    items_total: itemsTotal,
    items_ready: itemsReady,
    videos_total: telemetryNumber(m.videos_total) ?? undefined,
    videos_ready: telemetryNumber(m.videos_ready) ?? undefined,
    images_total: telemetryNumber(m.images_total) ?? undefined,
    images_ready: telemetryNumber(m.images_ready) ?? undefined,
    warming: telemetryBoolean(m.warming) ?? undefined,
    cache_bytes_used: telemetryNumber(m.cache_bytes_used) ?? undefined,
    cache_bytes_max: telemetryNumber(m.cache_bytes_max) ?? undefined,
    content_revision:
      typeof m.content_revision === "string" && m.content_revision.trim()
        ? m.content_revision.trim()
        : undefined,
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return mb >= 10 ? `${mb.toFixed(0)} MB` : `${mb.toFixed(1)} MB`;
  }
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 10 ? `${gb.toFixed(0)} GB` : `${gb.toFixed(2).replace(/\.?0+$/, "")} GB`;
}

function formatStorageUsage(used: number, max?: number): string | null {
  if (max != null && max > 0) {
    if (used <= 0) return `${formatBytes(max)} available`;
    return `${formatBytes(used)} of ${formatBytes(max)} used`;
  }
  if (used > 0) return `${formatBytes(used)} used`;
  return null;
}

function formatMediaBreakdown(cache: DeviceMediaCacheTelemetry): string | null {
  const videos = cache.videos_total ?? 0;
  const images = cache.images_total ?? 0;
  if (videos > 0 && images > 0) {
    const videoLabel = videos === 1 ? "1 video" : `${videos} videos`;
    const imageLabel = images === 1 ? "1 image" : `${images} images`;
    return `${videoLabel}, ${imageLabel}`;
  }
  return null;
}

function formatItemCount(count: number): string {
  return count === 1 ? "1 item" : `${count} items`;
}

export type DeviceMediaCacheSummary = {
  label: string;
  detail: string | null;
  tone: "ready" | "warming" | "partial" | "empty";
};

/** One-line cache status for device cards and the screen editor. */
export function deviceMediaCacheSummary(device: Device): DeviceMediaCacheSummary | null {
  const cache = getDeviceMediaCache(device);
  if (!cache) return null;
  const total = cache.items_total;
  if (total == null || total <= 0) return null;

  const ready = cache.items_ready ?? 0;
  const warming = cache.warming === true;

  let tone: DeviceMediaCacheSummary["tone"];
  let label: string;
  if (warming) {
    tone = "warming";
    label = ready > 0 ? `Downloading (${ready} of ${total})` : "Downloading content";
  } else if (ready >= total) {
    tone = "ready";
    label = total === 1 ? "Content saved on screen" : "All content saved on screen";
  } else if (ready <= 0) {
    tone = "empty";
    label = "Content not on screen yet";
  } else {
    tone = "partial";
    label = `${ready} of ${total} items saved`;
  }

  const parts: string[] = [];
  const breakdown = formatMediaBreakdown(cache);
  if (breakdown) {
    parts.push(breakdown);
  } else if (ready >= total) {
    parts.push(formatItemCount(total));
  }

  const storage = formatStorageUsage(cache.cache_bytes_used ?? 0, cache.cache_bytes_max);
  if (storage) parts.push(storage);

  const detail = parts.length > 0 ? parts.join(" · ") : null;

  return {
    label,
    detail,
    tone,
  };
}
