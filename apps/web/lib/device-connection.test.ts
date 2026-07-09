import { describe, expect, it } from "vitest";
import type { Device } from "@signage/types";
import {
  deviceConnectionHint,
  deviceConnectionLabel,
  getDeviceConnectionState,
} from "@/lib/device-connection";

describe("device-connection", () => {
  const base = {
    status: "offline" as const,
    last_seen: null,
    platform: "browser" as const,
  };

  it("returns connected when heartbeat is fresh", () => {
    const state = getDeviceConnectionState({
      status: "online",
      last_seen: new Date().toISOString(),
    });
    expect(state).toBe("connected");
    expect(deviceConnectionLabel(state)).toBe("Connected");
  });

  it("returns never_connected when there is no last_seen", () => {
    const state = getDeviceConnectionState(base);
    expect(state).toBe("never_connected");
    expect(deviceConnectionHint(state, base)).toBe("Is your screen showing a pairing code?");
  });

  it("returns unreachable when linked but stale", () => {
    const device = {
      ...base,
      last_seen: "2026-01-01T00:00:00.000Z",
      status: "offline" as const,
    };
    const state = getDeviceConnectionState(device);
    expect(state).toBe("unreachable");
    expect(deviceConnectionHint(state, device)).toBe("Is your screen showing a pairing code?");
  });
});
