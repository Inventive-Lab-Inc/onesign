import { describe, expect, it } from "vitest";
import type { Device } from "@signage/types";
import {
  applyDeviceFilters,
  applyDeviceSearchFilter,
  DEFAULT_DEVICE_FILTERS,
  sortDeviceList,
} from "./device-display";

function makeDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: "d1",
    owner_id: "u1",
    registered_session_id: null,
    pairing_code: "123456",
    name: "Screen A",
    status: "online",
    last_seen: "2026-06-15T12:00:00.000Z",
    created_at: "2026-06-01T12:00:00.000Z",
    screen_orientation: "landscape",
    tags: [],
    ...overrides,
  };
}

describe("sortDeviceList", () => {
  it("sorts by name ascending", () => {
    const list = [makeDevice({ id: "1", name: "Zulu" }), makeDevice({ id: "2", name: "Alpha" })];
    const sorted = sortDeviceList(list, "name-asc");
    expect(sorted.map((d) => d.name)).toEqual(["Alpha", "Zulu"]);
  });

  it("sorts by last seen newest first", () => {
    const list = [
      makeDevice({ id: "1", last_seen: "2026-06-10T12:00:00.000Z" }),
      makeDevice({ id: "2", last_seen: "2026-06-16T12:00:00.000Z" }),
    ];
    const sorted = sortDeviceList(list, "last-seen-desc");
    expect(sorted[0]?.id).toBe("2");
  });
});

describe("applyDeviceFilters", () => {
  it("filters by tag substring", () => {
    const list = [
      makeDevice({ id: "1", tags: ["lobby"] }),
      makeDevice({ id: "2", tags: ["kitchen"] }),
    ];
    const filtered = applyDeviceFilters(list, { ...DEFAULT_DEVICE_FILTERS, tagFilter: "lob" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("1");
  });
});

describe("applyDeviceSearchFilter", () => {
  it("matches screen name case-insensitively", () => {
    const list = [makeDevice({ name: "Lobby Screen" }), makeDevice({ id: "2", name: "Kitchen" })];
    const filtered = applyDeviceSearchFilter(list, "lobby");
    expect(filtered).toHaveLength(1);
  });
});
