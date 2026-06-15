import type { Device } from "@signage/types";
import { getDeviceInstalledApp } from "@/lib/device-app-version";
import { effectiveDeviceStatus } from "@/lib/device-status";
import { getDeviceMediaCache } from "@/lib/device-media-cache";

export type DeviceInfoRow = {
  label: string;
  value: string;
};

export type DeviceHistoryEvent = {
  at: string;
  label: string;
  detail?: string;
};

function telemetryString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function deviceHardwareLabel(device: Device): { brand: string | null; model: string | null } {
  const t = device.telemetry;
  if (!t || typeof t !== "object") return { brand: null, model: null };
  const hw = t.hardware;
  if (!hw || typeof hw !== "object") return { brand: null, model: null };
  const h = hw as Record<string, unknown>;
  const brand = telemetryString(h.brand) ?? telemetryString(h.manufacturer);
  return { brand, model: telemetryString(h.model) };
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatMegabytes(bytes: number | null | undefined): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return null;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function statusLabel(status: ReturnType<typeof effectiveDeviceStatus>): string {
  switch (status) {
    case "online":
      return "Online";
    case "offline":
      return "Offline";
    case "pending_pairing":
      return "Pending pairing";
    default:
      return status;
  }
}

export function buildDeviceInformationRows(
  device: Device,
  options?: { lastPlaylistChangeAt?: string | null },
): DeviceInfoRow[] {
  const basics = deviceHardwareLabel(device);
  const installed = getDeviceInstalledApp(device);
  const cache = getDeviceMediaCache(device);
  const storageTotal = formatMegabytes(cache?.cache_bytes_max);
  const storageUsed = cache?.cache_bytes_used;
  const storageFree =
    cache?.cache_bytes_max != null && storageUsed != null
      ? formatMegabytes(Math.max(0, cache.cache_bytes_max - storageUsed))
      : null;

  const rows: DeviceInfoRow[] = [
    { label: "Last seen", value: formatWhen(device.last_seen) },
    { label: "Status", value: statusLabel(effectiveDeviceStatus(device)) },
  ];

  if (options?.lastPlaylistChangeAt) {
    rows.push({ label: "Last playlist change", value: formatWhen(options.lastPlaylistChangeAt) });
  }

  if (basics.brand) rows.push({ label: "Manufacturer", value: basics.brand });
  if (basics.model) rows.push({ label: "Model", value: basics.model });
  if (storageTotal) rows.push({ label: "Storage total", value: storageTotal });
  if (storageFree) rows.push({ label: "Storage free", value: storageFree });
  rows.push({ label: "Screen linked", value: formatWhen(device.created_at) });
  if (device.telemetry_at) {
    rows.push({ label: "Last telemetry report", value: formatWhen(device.telemetry_at) });
  }
  if (installed.versionName) {
    rows.push({ label: "App version", value: installed.versionName });
  }

  return rows;
}

export function buildDeviceHistoryEvents(
  device: Device,
  options?: { lastPlaylistChangeAt?: string | null },
): DeviceHistoryEvent[] {
  const events: DeviceHistoryEvent[] = [
    { at: device.created_at, label: "Screen linked", detail: "Paired to your account" },
  ];

  if (options?.lastPlaylistChangeAt) {
    events.push({
      at: options.lastPlaylistChangeAt,
      label: "Playlist updated",
      detail: "Content assignment changed",
    });
  }

  if (device.telemetry_at) {
    events.push({
      at: device.telemetry_at,
      label: "Telemetry received",
      detail: "Device reported status to the console",
    });
  }

  if (device.last_seen) {
    events.push({
      at: device.last_seen,
      label: "Last online",
      detail: "Most recent check-in from the TV app",
    });
  }

  return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
