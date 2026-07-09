import { describe, expect, it } from "vitest";
import type { Device } from "@signage/types";
import {
  buildDeviceHistoryEvents,
  buildDeviceInformationRows,
  buildDeviceNameFromTelemetry,
  resolveDeviceDisplayName,
} from "./device-information";

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

describe("buildDeviceNameFromTelemetry", () => {
  it("combines manufacturer and model with a dash", () => {
    expect(
      buildDeviceNameFromTelemetry({
        hardware: { manufacturer: "vivo", model: "XT123" },
      }),
    ).toBe("vivo - XT123");
  });

  it("prefers brand over manufacturer", () => {
    expect(
      buildDeviceNameFromTelemetry({
        hardware: { brand: "Vivo", manufacturer: "vivo", model: "XT123" },
      }),
    ).toBe("Vivo - XT123");
  });

  it("returns only manufacturer or model when the other is missing", () => {
    expect(buildDeviceNameFromTelemetry({ hardware: { manufacturer: "Sony" } })).toBe("Sony");
    expect(buildDeviceNameFromTelemetry({ hardware: { model: "BRAVIA" } })).toBe("BRAVIA");
  });

  it("returns null when telemetry has no hardware info", () => {
    expect(buildDeviceNameFromTelemetry(null)).toBeNull();
    expect(buildDeviceNameFromTelemetry({})).toBeNull();
  });
});

describe("resolveDeviceDisplayName", () => {
  it("uses telemetry when the stored name is empty", () => {
    expect(
      resolveDeviceDisplayName({
        name: null,
        telemetry: { hardware: { manufacturer: "vivo", model: "XT123" } },
      }),
    ).toBe("vivo - XT123");
  });

  it("keeps a user-provided name over telemetry", () => {
    expect(
      resolveDeviceDisplayName({
        name: "Lobby TV",
        telemetry: { hardware: { manufacturer: "vivo", model: "XT123" } },
      }),
    ).toBe("Lobby TV");
  });

  it("replaces the generic TV Device default with telemetry", () => {
    expect(
      resolveDeviceDisplayName({
        name: "TV Device",
        telemetry: { hardware: { brand: "Sony", model: "BRAVIA" } },
      }),
    ).toBe("Sony - BRAVIA");
  });
});

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
