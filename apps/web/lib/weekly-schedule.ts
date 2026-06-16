import type { WeeklyDaySchedule, WeeklySchedule, WeekdayKey } from "@signage/types";

export const WEEKDAY_KEYS: WeekdayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export const DEFAULT_DAY_WINDOW: WeeklyDaySchedule = { start: "00:00", end: "23:59" };

export function createDefaultWeeklySchedule(): WeeklySchedule {
  return Object.fromEntries(WEEKDAY_KEYS.map((day) => [day, { ...DEFAULT_DAY_WINDOW }])) as WeeklySchedule;
}

export function normalizeWeeklySchedule(input: WeeklySchedule | null | undefined): WeeklySchedule {
  const base = createDefaultWeeklySchedule();
  if (!input) return base;
  for (const day of WEEKDAY_KEYS) {
    const row = input[day];
    if (row?.start && row?.end) {
      base[day] = { start: row.start, end: row.end };
    }
  }
  return base;
}

export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Migration/default DB value — not yet auto-detected for this screen. */
export function isAutoDetectScreenTimezone(stored?: string | null): boolean {
  const value = stored?.trim();
  return !value || value === "UTC";
}

export function resolveScreenTimezone(stored?: string | null): string {
  if (!isAutoDetectScreenTimezone(stored)) return stored!.trim();
  return detectBrowserTimezone();
}

export function weeklySchedulesEqual(a: WeeklySchedule, b: WeeklySchedule): boolean {
  return WEEKDAY_KEYS.every((day) => a[day].start === b[day].start && a[day].end === b[day].end);
}
