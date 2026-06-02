import type { AppRelease, Device } from "@signage/types";

export type DeviceInstalledApp = {
  versionCode: number | null;
  versionName: string | null;
};

export type DeviceAppUpdateStatus = "unknown" | "current" | "update_available" | "ahead";

function telemetryString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

/** Installed TV app version from `devices.telemetry.app` (Android `DeviceTelemetryCollector`). */
export function getDeviceInstalledApp(device: Device): DeviceInstalledApp {
  const t = device.telemetry;
  if (!t || typeof t !== "object") {
    return { versionCode: null, versionName: null };
  }
  const app = t.app;
  if (!app || typeof app !== "object") {
    return { versionCode: null, versionName: null };
  }
  const record = app as Record<string, unknown>;
  const versionName = telemetryString(record.version_name);
  const rawCode = record.version_code;
  const versionCode =
    typeof rawCode === "number"
      ? rawCode
      : typeof rawCode === "string"
        ? Number.parseInt(rawCode, 10)
        : Number.NaN;
  return {
    versionCode: Number.isFinite(versionCode) ? versionCode : null,
    versionName,
  };
}

export function deviceAppUpdateStatus(
  installed: DeviceInstalledApp,
  activeRelease: Pick<AppRelease, "version_code" | "version_name"> | null | undefined,
): DeviceAppUpdateStatus {
  if (!activeRelease) return "unknown";
  if (installed.versionCode == null) return "unknown";
  if (installed.versionCode < activeRelease.version_code) return "update_available";
  if (installed.versionCode > activeRelease.version_code) return "ahead";
  return "current";
}

export function deviceInstalledAppLabel(installed: DeviceInstalledApp): string | null {
  if (installed.versionName) return `v${installed.versionName}`;
  if (installed.versionCode != null) return `#${installed.versionCode}`;
  return null;
}
