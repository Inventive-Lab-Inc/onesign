import { describe, expect, it } from "vitest";
import type { Device } from "@signage/types";
import { deviceMediaCacheSummary, getDeviceMediaCache } from "@/lib/device-media-cache";

function deviceWithMediaCache(mediaCache: Record<string, unknown>): Device {
  return {
    id: "dev-1",
    name: "Lobby TV",
    status: "online",
    last_seen: new Date().toISOString(),
    telemetry: { media_cache: mediaCache },
  } as Device;
}

describe("getDeviceMediaCache", () => {
  it("parses media_cache from telemetry", () => {
    const parsed = getDeviceMediaCache(
      deviceWithMediaCache({
        items_total: 5,
        items_ready: 3,
        videos_total: 2,
        videos_ready: 1,
        images_total: 3,
        images_ready: 2,
        warming: true,
        cache_bytes_used: 1048576,
        cache_bytes_max: 1073741824,
      }),
    );
    expect(parsed).toEqual({
      items_total: 5,
      items_ready: 3,
      videos_total: 2,
      videos_ready: 1,
      images_total: 3,
      images_ready: 2,
      warming: true,
      cache_bytes_used: 1048576,
      cache_bytes_max: 1073741824,
    });
  });

  it("returns null when media_cache is missing", () => {
    expect(getDeviceMediaCache({ id: "x", name: "x", status: "online" } as Device)).toBeNull();
  });
});

describe("deviceMediaCacheSummary", () => {
  it("shows preparing when warming and incomplete", () => {
    const summary = deviceMediaCacheSummary(
      deviceWithMediaCache({ items_total: 4, items_ready: 1, warming: true }),
    );
    expect(summary?.label).toBe("Downloading (1 of 4)");
    expect(summary?.tone).toBe("warming");
  });

  it("shows ready when all items cached", () => {
    const summary = deviceMediaCacheSummary(
      deviceWithMediaCache({ items_total: 2, items_ready: 2, warming: false }),
    );
    expect(summary?.label).toBe("All content saved on screen");
    expect(summary?.detail).toBe("2 items");
    expect(summary?.tone).toBe("ready");
  });

  it("uses plain language for image-only playlists with storage", () => {
    const summary = deviceMediaCacheSummary(
      deviceWithMediaCache({
        items_total: 3,
        items_ready: 3,
        images_total: 3,
        images_ready: 3,
        cache_bytes_used: 0,
        cache_bytes_max: 1073741824,
      }),
    );
    expect(summary?.label).toBe("All content saved on screen");
    expect(summary?.detail).toBe("3 items · 1 GB available");
  });
});
