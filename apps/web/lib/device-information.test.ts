import { describe, expect, it } from "vitest";
import type { Device } from "@signage/types";
import { buildDeviceHistoryEvents, buildDeviceInformationRows } from "./device-information";

function makeDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: "d1",
    public_code: "abc12345",
    owner_id: "u1",
    registered_session_id: null,
    pairing_code: "123456",
    name: "Lobby",
    status: "online",
    last_seen: "2026-06-16T01:00:00.000Z",
    created_at: "2026-06-01T12:00:00.000Z",
    telemetry_at: "2026-06-16T00:30:00.000Z",
    ...overrides,
  };
}

describe("buildDeviceInformationRows", () => {
  it("includes playlist change when provided", () => {
    const rows = buildDeviceInformationRows(makeDevice(), {
      lastPlaylistChangeAt: "2026-06-10T08:00:00.000Z",
    });
    expect(rows.some((row) => row.label === "Last playlist change")).toBe(true);
  });
});

describe("buildDeviceHistoryEvents", () => {
  it("sorts events newest first", () => {
    const events = buildDeviceHistoryEvents(makeDevice(), {
      lastPlaylistChangeAt: "2026-06-10T08:00:00.000Z",
    });
    expect(events[0]?.label).toBe("Last online");
  });
});
