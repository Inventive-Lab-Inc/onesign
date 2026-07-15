import { describe, expect, it } from "vitest";
import type { PlaylistItemWithMedia } from "@signage/types";
import {
  buildMonthGrid,
  dayKeyFromDate,
  expandPlaylistScheduleEvents,
  groupEventsByDay,
} from "./schedule-calendar";

function media(filename: string): NonNullable<PlaylistItemWithMedia["media"]> {
  return {
    id: `m-${filename}`,
    storage_path: `path/${filename}`,
    file_type: "image",
    original_filename: filename,
    duration_seconds: null,
    display_from: null,
    display_until: null,
  };
}

function item(partial: Partial<PlaylistItemWithMedia> & { id: string; label?: string }): PlaylistItemWithMedia {
  return {
    id: partial.id,
    playlist_id: "pl-1",
    media_id: "m-1",
    website_id: null,
    sort_order: partial.sort_order ?? 0,
    duration_seconds: 10,
    display_from: partial.display_from ?? null,
    display_until: partial.display_until ?? null,
    created_at: "2026-01-01T00:00:00Z",
    daily_schedule_enabled: partial.daily_schedule_enabled ?? false,
    daily_schedule: partial.daily_schedule ?? null,
    media: partial.media ?? media(partial.label ?? "Clip.jpg"),
    website: partial.website ?? null,
  };
}

describe("buildMonthGrid", () => {
  it("returns 42 days starting on Sunday", () => {
    const grid = buildMonthGrid(new Date(2022, 9, 15)); // Oct 2022
    expect(grid).toHaveLength(42);
    expect(grid[0]!.getDay()).toBe(0);
    expect(dayKeyFromDate(grid[0]!)).toBe("2022-09-25");
  });
});

describe("expandPlaylistScheduleEvents", () => {
  it("expands always-on items across each day in range", () => {
    const events = expandPlaylistScheduleEvents({
      playlistId: "pl-1",
      items: [item({ id: "a", label: "ad.jpg" })],
      rangeStart: new Date(2026, 6, 13),
      rangeEnd: new Date(2026, 6, 14),
    });
    expect(events).toHaveLength(2);
    expect(events[0]!.label).toBe("ad.jpg");
    expect(events[0]!.startLabel).toBe("00:00");
    expect(events[0]!.endLabel).toBe("23:59");
  });

  it("uses daily schedule windows on matching weekdays", () => {
    const events = expandPlaylistScheduleEvents({
      playlistId: "pl-1",
      items: [
        item({
          id: "b",
          label: "news.jpg",
          daily_schedule_enabled: true,
          daily_schedule: {
            monday: { start: "09:00", end: "12:00" },
            tuesday: { start: "00:00", end: "23:59" },
            wednesday: { start: "00:00", end: "23:59" },
            thursday: { start: "00:00", end: "23:59" },
            friday: { start: "00:00", end: "23:59" },
            saturday: { start: "00:00", end: "23:59" },
            sunday: { start: "00:00", end: "23:59" },
          },
        }),
      ],
      rangeStart: new Date(2026, 6, 13), // Monday
      rangeEnd: new Date(2026, 6, 13),
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.startLabel).toBe("09:00");
    expect(events[0]!.endLabel).toBe("12:00");
  });

  it("hides items outside their absolute display window", () => {
    const events = expandPlaylistScheduleEvents({
      playlistId: "pl-1",
      items: [
        item({
          id: "c",
          display_from: "2026-08-01T00:00:00.000Z",
          display_until: "2026-08-31T23:59:59.000Z",
        }),
      ],
      rangeStart: new Date(2026, 6, 13),
      rangeEnd: new Date(2026, 6, 13),
    });
    expect(events).toHaveLength(0);
  });
});

describe("groupEventsByDay", () => {
  it("groups and sorts by start time", () => {
    const monday = new Date(2026, 6, 13); // Monday
    const events = expandPlaylistScheduleEvents({
      playlistId: "pl-1",
      items: [
        item({ id: "z", sort_order: 1, label: "zulu.jpg" }),
        item({
          id: "a",
          sort_order: 0,
          label: "alpha.jpg",
          daily_schedule_enabled: true,
          daily_schedule: {
            monday: { start: "08:00", end: "09:00" },
            tuesday: { start: "00:00", end: "23:59" },
            wednesday: { start: "00:00", end: "23:59" },
            thursday: { start: "00:00", end: "23:59" },
            friday: { start: "00:00", end: "23:59" },
            saturday: { start: "00:00", end: "23:59" },
            sunday: { start: "00:00", end: "23:59" },
          },
        }),
      ],
      rangeStart: monday,
      rangeEnd: monday,
    });
    const grouped = groupEventsByDay(events);
    const dayEvents = grouped[dayKeyFromDate(monday)] ?? [];
    expect(dayEvents.map((event) => event.label)).toEqual(["zulu.jpg", "alpha.jpg"]);
    expect(dayEvents[1]!.startLabel).toBe("08:00");
  });
});
