import type { Device } from "@signage/types";
import {
  detectBrowserTimezone,
  isAutoDetectScreenTimezone,
} from "@/lib/weekly-schedule";

export function deviceTelemetryTimezone(
  device: Pick<Device, "telemetry">,
): string | null {
  const value = device.telemetry?.timezone;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Effective IANA timezone for a screen: TV-reported first, browser only as last resort. */
export function resolveDeviceScreenTimezone(
  device: Pick<Device, "operating_hours_timezone" | "operating_hours_timezone_auto" | "telemetry">,
): string {
  const stored = device.operating_hours_timezone?.trim();
  const auto = device.operating_hours_timezone_auto ?? true;
  const fromTv = deviceTelemetryTimezone(device);

  if (!auto && stored) return stored;
  if (fromTv) return fromTv;
  if (stored && !isAutoDetectScreenTimezone(stored)) return stored;
  if (stored) return stored;
  return detectBrowserTimezone();
}
