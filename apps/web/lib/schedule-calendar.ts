import type { PlaylistItemWithMedia, WeekdayKey, WeeklySchedule } from "@signage/types";
import { playbackScheduleIsActive } from "@/lib/media-schedule";
import { normalizeWeeklySchedule } from "@/lib/weekly-schedule";

export type CalendarViewMode = "day" | "week" | "month";

export type ScheduleCalendarEvent = {
  id: string;
  itemId: string;
  playlistId: string;
  label: string;
  /** Local calendar day (yyyy-mm-dd). */
  dayKey: string;
  startMinutes: number;
  endMinutes: number;
  startLabel: string;
  endLabel: string;
  colorIndex: number;
};

const JS_DAY_TO_WEEKDAY: WeekdayKey[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/** Distinct block colors matching the schedule mockup palette. */
export const SCHEDULE_EVENT_COLORS = [
  { bg: "#e5e7eb", text: "#374151", border: "#d1d5db" }, // grey — default/ad
  { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" }, // blue — entertainment
  { bg: "#fce7f3", text: "#be185d", border: "#f9a8d4" }, // pink
  { bg: "#fef3c7", text: "#a16207", border: "#fcd34d" }, // yellow — news
  { bg: "#d1fae5", text: "#047857", border: "#6ee7b7" }, // green — brand
  { bg: "#e0e7ff", text: "#4338ca", border: "#a5b4fc" }, // indigo
] as const;

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function dayKeyFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDayKey(dayKey: string): Date {
  const parts = dayKey.split("-").map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(y, m - 1, d);
}

export function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function formatDayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatWeekRangeLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const start = weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const end = weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${start} – ${end}`;
}

export function minutesToLabel(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseHhMm(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function weekdayKeyForDate(date: Date): WeekdayKey {
  return JS_DAY_TO_WEEKDAY[date.getDay()]!;
}

/** Sunday-start month grid (6 weeks × 7 days). */
export function buildMonthGrid(anchor: Date): Date[] {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = addDays(firstOfMonth, -firstOfMonth.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

export function startOfWeekSunday(date: Date): Date {
  const start = startOfLocalDay(date);
  return addDays(start, -start.getDay());
}

function itemLabel(item: PlaylistItemWithMedia): string {
  const mediaName = item.media?.original_filename?.trim();
  if (mediaName) return mediaName;
  const websiteName = item.website?.name?.trim();
  if (websiteName) return websiteName;
  return "Untitled";
}

function assetActiveOnDay(item: PlaylistItemWithMedia, day: Date): boolean {
  const noon = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0);
  if (item.media) return playbackScheduleIsActive(item.media, noon);
  if (item.website) return playbackScheduleIsActive(item.website, noon);
  return true;
}

function itemWindowActiveOnDay(item: PlaylistItemWithMedia, day: Date): boolean {
  const noon = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0);
  return playbackScheduleIsActive(
    { display_from: item.display_from, display_until: item.display_until },
    noon,
  );
}

function colorIndexForItem(itemId: string): number {
  let hash = 0;
  for (let i = 0; i < itemId.length; i += 1) {
    hash = (hash * 31 + itemId.charCodeAt(i)) >>> 0;
  }
  return hash % SCHEDULE_EVENT_COLORS.length;
}

function windowForDay(
  item: PlaylistItemWithMedia,
  day: Date,
): { startMinutes: number; endMinutes: number } | null {
  if (!assetActiveOnDay(item, day) || !itemWindowActiveOnDay(item, day)) {
    return null;
  }

  if (item.daily_schedule_enabled) {
    const schedule = normalizeWeeklySchedule(item.daily_schedule as WeeklySchedule | null);
    const dayWindow = schedule[weekdayKeyForDate(day)];
    const startMinutes = parseHhMm(dayWindow?.start) ?? 0;
    const endMinutes = parseHhMm(dayWindow?.end) ?? 23 * 60 + 59;
    if (endMinutes <= startMinutes) return null;
    return { startMinutes, endMinutes };
  }

  // Absolute-only or always-on: full day within the item window.
  return { startMinutes: 0, endMinutes: 23 * 60 + 59 };
}

/**
 * Expand playlist items into concrete calendar blocks for each local day in [rangeStart, rangeEnd].
 * Days are inclusive. Always-on items appear as 00:00–23:59 on every active day.
 */
export function expandPlaylistScheduleEvents(options: {
  playlistId: string;
  items: PlaylistItemWithMedia[];
  rangeStart: Date;
  rangeEnd: Date;
}): ScheduleCalendarEvent[] {
  const { playlistId, items, rangeStart, rangeEnd } = options;
  const start = startOfLocalDay(rangeStart);
  const end = startOfLocalDay(rangeEnd);
  if (end < start) return [];

  const events: ScheduleCalendarEvent[] = [];
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);

  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    const key = dayKeyFromDate(cursor);
    for (const item of sorted) {
      const window = windowForDay(item, cursor);
      if (!window) continue;
      events.push({
        id: `${item.id}:${key}`,
        itemId: item.id,
        playlistId,
        label: itemLabel(item),
        dayKey: key,
        startMinutes: window.startMinutes,
        endMinutes: window.endMinutes,
        startLabel: minutesToLabel(window.startMinutes),
        endLabel: minutesToLabel(window.endMinutes),
        colorIndex: colorIndexForItem(item.id),
      });
    }
  }

  return events;
}

export function groupEventsByDay(
  events: ScheduleCalendarEvent[],
): Record<string, ScheduleCalendarEvent[]> {
  const grouped: Record<string, ScheduleCalendarEvent[]> = {};
  for (const event of events) {
    const list = grouped[event.dayKey] ?? [];
    list.push(event);
    grouped[event.dayKey] = list;
  }
  for (const key of Object.keys(grouped)) {
    grouped[key]!.sort((a, b) => a.startMinutes - b.startMinutes || a.label.localeCompare(b.label));
  }
  return grouped;
}
