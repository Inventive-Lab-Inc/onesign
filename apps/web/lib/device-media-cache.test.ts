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
  it("shows compact caching label while warming", () => {
    const summary = deviceMediaCacheSummary(
      deviceWithMediaCache({ items_total: 4, items_ready: 1, warming: true, cache_bytes_used: 1048576 }),
    );
    expect(summary?.label).toBe("Caching 1/4 (1mb)");
    expect(summary?.tone).toBe("warming");
  });

  it("shows compact cached label when all items are ready", () => {
    const summary = deviceMediaCacheSummary(
      deviceWithMediaCache({ items_total: 2, items_ready: 2, warming: false, cache_bytes_used: 52428800 }),
    );
    expect(summary?.label).toBe("Cached 2/2 (50mb)");
    expect(summary?.detail).toBeNull();
    expect(summary?.tone).toBe("ready");
  });

  it("shows partial progress and used storage", () => {
    const summary = deviceMediaCacheSummary(
      deviceWithMediaCache({
        items_total: 3,
        items_ready: 1,
        warming: false,
        cache_bytes_used: 40370176,
      }),
    );
    expect(summary?.label).toBe("Cached 1/3 (38.5mb)");
    expect(summary?.tone).toBe("partial");
  });

  it("omits size when nothing is stored yet", () => {
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
    expect(summary?.label).toBe("Cached 3/3");
    expect(summary?.tone).toBe("ready");
  });
});
