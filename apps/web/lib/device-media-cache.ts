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

function formatBytesCompact(bytes: number): string | null {
  if (bytes <= 0) return null;
  if (bytes < 1024) return `${bytes}b`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    const value = kb >= 100 ? kb.toFixed(0) : kb.toFixed(1).replace(/\.0$/, "");
    return `${value}kb`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    const value = mb >= 100 ? mb.toFixed(0) : mb.toFixed(1).replace(/\.0$/, "");
    return `${value}mb`;
  }
  const gb = bytes / (1024 * 1024 * 1024);
  const value = gb >= 10 ? gb.toFixed(0) : gb.toFixed(1).replace(/\.0$/, "");
  return `${value}gb`;
}

function buildCacheLabel(ready: number, total: number, warming: boolean, bytesUsed: number): string {
  const ratio = `${ready}/${total}`;
  const size = formatBytesCompact(bytesUsed);
  const sizeSuffix = size ? ` (${size})` : "";
  const verb = warming ? "Caching" : "Cached";
  return `${verb} ${ratio}${sizeSuffix}`;
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
  const bytesUsed = cache.cache_bytes_used ?? 0;

  let tone: DeviceMediaCacheSummary["tone"];
  if (warming) {
    tone = "warming";
  } else if (ready >= total) {
    tone = "ready";
  } else if (ready <= 0) {
    tone = "empty";
  } else {
    tone = "partial";
  }

  return {
    label: buildCacheLabel(ready, total, warming, bytesUsed),
    detail: null,
    tone,
  };
}
