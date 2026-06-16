import type { Website, WebsiteSourceType } from "@signage/types";
import { getAppUrl } from "@/lib/auth/app-url";
import { mediaPublicUrl } from "@/lib/object-storage/urls";

export function normalizeWebsiteUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function buildWebsitePlaybackUrl(
  sourceType: WebsiteSourceType,
  values: {
    websiteId?: string;
    url?: string | null;
    storagePath?: string | null;
    zoomLevel?: number;
  },
): string {
  if (sourceType === "url") {
    const normalized = normalizeWebsiteUrl(values.url ?? "");
    if (!normalized) throw new Error("Invalid website URL.");
    return normalized;
  }

  if (sourceType === "file") {
    const path = values.storagePath?.trim();
    if (!path) throw new Error("Missing uploaded file path.");
    return mediaPublicUrl(path);
  }

  const id = values.websiteId?.trim();
  if (!id) throw new Error("Website id is required for HTML playback URL.");
  const zoom = values.zoomLevel ?? 100;
  const base = getAppUrl().replace(/\/$/, "");
  return `${base}/display/website/${encodeURIComponent(id)}?zoom=${encodeURIComponent(String(zoom))}`;
}

export function websitePreviewUrl(website: Pick<Website, "source_type" | "url" | "playback_url">): string {
  if (website.source_type === "url" && website.url) {
    return website.url;
  }
  return website.playback_url;
}

export function websiteDisplayUrl(website: Website): string {
  return website.playback_url;
}
