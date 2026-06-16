import type { Device, WeekdayKey, WeeklySchedule } from "@signage/types";
import { resolveDeviceScreenTimezone } from "@/lib/screen-timezone";
import {
  createDefaultWeeklySchedule,
  normalizeWeeklySchedule,
  weeklySchedulesEqual,
} from "@/lib/weekly-schedule";

const WEEKDAY_FROM_INTL: Record<string, WeekdayKey> = {
  Monday: "monday",
  Tuesday: "tuesday",
  Wednesday: "wednesday",
  Thursday: "thursday",
  Friday: "friday",
  Saturday: "saturday",
  Sunday: "sunday",
};

function parseClockMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number.parseInt(match[1]!, 10);
  const minutes = Number.parseInt(match[2]!, 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

function localClockParts(
  date: Date,
  timeZone: string,
): { weekday: WeekdayKey; minutes: number } | null {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const weekdayLabel = parts.find((part) => part.type === "weekday")?.value;
    const hour = parts.find((part) => part.type === "hour")?.value;
    const minute = parts.find((part) => part.type === "minute")?.value;
    if (!weekdayLabel || hour == null || minute == null) return null;
    const weekday = WEEKDAY_FROM_INTL[weekdayLabel];
    if (!weekday) return null;
    const minutes = Number.parseInt(hour, 10) * 60 + Number.parseInt(minute, 10);
    if (!Number.isFinite(minutes)) return null;
    return { weekday, minutes };
  } catch {
    return null;
  }
}

function isWithinDayWindow(minutes: number, window: { start: string; end: string }): boolean {
  const start = parseClockMinutes(window.start);
  const end = parseClockMinutes(window.end);
  if (start == null || end == null) return true;
  if (start <= end) {
    return minutes >= start && minutes <= end;
  }
  return minutes >= start || minutes <= end;
}

export function deviceOperatingSchedule(device: Pick<Device, "operating_hours">): WeeklySchedule {
  return normalizeWeeklySchedule(device.operating_hours);
}

/** True when the screen has a non-default schedule or blanks outside hours. */
export function deviceHasConfiguredOperatingHours(
  device: Pick<Device, "operating_hours" | "blank_when_off_hours">,
): boolean {
  if (device.blank_when_off_hours) return true;
  return !weeklySchedulesEqual(deviceOperatingSchedule(device), createDefaultWeeklySchedule());
}

/** Whether the screen is inside its configured weekly window (before inversion). */
export function isDeviceInsideScheduleWindow(
  device: Pick<Device, "operating_hours" | "operating_hours_timezone" | "operating_hours_timezone_auto" | "telemetry">,
  at: Date = new Date(),
): boolean {
  const schedule = deviceOperatingSchedule(device);
  const timeZone = resolveDeviceScreenTimezone(device);
  const local = localClockParts(at, timeZone);
  if (!local) return true;
  return isWithinDayWindow(local.minutes, schedule[local.weekday]);
}

/** Whether playback should be considered outside operating hours right now. */
export function isDeviceOutsideOperatingHours(
  device: Pick<
    Device,
    | "operating_hours"
    | "operating_hours_timezone"
    | "operating_hours_timezone_auto"
    | "operating_hours_inverted"
    | "telemetry"
  >,
  at: Date = new Date(),
): boolean {
  if (!deviceHasConfiguredOperatingHours(device)) return false;
  const inside = isDeviceInsideScheduleWindow(device, at);
  const inverted = device.operating_hours_inverted ?? false;
  return inverted ? inside : !inside;
}
