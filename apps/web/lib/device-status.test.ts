import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { effectiveDeviceStatus, STALE_ONLINE_MS } from "@/lib/device-status";

describe("effectiveDeviceStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns online when status is online and last_seen is within the stale window", () => {
    const lastSeen = new Date(Date.now() - STALE_ONLINE_MS + 1_000).toISOString();

    expect(
      effectiveDeviceStatus({
        status: "online",
        last_seen: lastSeen,
      }),
    ).toBe("online");
  });

  it("returns offline immediately when status is offline even with fresh last_seen", () => {
    const lastSeen = new Date(Date.now() - 5_000).toISOString();

    expect(
      effectiveDeviceStatus({
        status: "offline",
        last_seen: lastSeen,
      }),
    ).toBe("offline");
  });

  it("returns offline when last_seen is older than the stale window", () => {
    const lastSeen = new Date(Date.now() - STALE_ONLINE_MS - 1_000).toISOString();

    expect(
      effectiveDeviceStatus({
        status: "online",
        last_seen: lastSeen,
      }),
    ).toBe("offline");
  });

  it("returns pending_pairing unchanged", () => {
    expect(
      effectiveDeviceStatus({
        status: "pending_pairing",
        last_seen: null,
      }),
    ).toBe("pending_pairing");
  });
});
