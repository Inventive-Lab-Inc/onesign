import type { Device, DeviceStatus } from "@signage/types";

/**
 * Max age of `last_seen` while we still show Online (TV heartbeats every ~30s).
 * Allow two missed heartbeats plus network margin — do not tie this to sync-side
 * `mark_stale_devices_offline` (removed from console pull; that RPC uses 45s in DB).
 */
export const STALE_ONLINE_MS = 90_000;

/** Fixed locale so SSR (Vercel) and browser hydration produce identical text. */
const DEVICE_DATE_LOCALE = "en-GB";

/**
 * DB `status` can lag behind TV heartbeats (e.g. after mark_stale_devices_offline on sync).
 * Fresh `last_seen` is the source of truth for whether the screen is reachable right now,
 * except when the TV explicitly reports offline via [tv_device_offline] on shutdown.
 */
export function effectiveDeviceStatus(device: Pick<Device, "status" | "last_seen">): DeviceStatus {
  if (device.status === "pending_pairing") return "pending_pairing";
  if (device.status === "offline") return "offline";

  if (device.last_seen != null) {
    const ageMs = Date.now() - new Date(device.last_seen).getTime();
    if (Number.isFinite(ageMs) && ageMs <= STALE_ONLINE_MS) {
      return "online";
    }
  }

  if (device.status === "online") return "offline";
  return device.status ?? "offline";
}

/**
 * Human-readable `last_seen` age. Uses the same freshness window as [effectiveDeviceStatus]
 * ("Just now" only while `last_seen` is within [STALE_ONLINE_MS]) so the label never implies
 * liveness when the badge would show offline for staleness.
 */
export function formatDeviceLastSeen(iso: string | null): string {
  if (!iso) return "Never seen";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  if (!Number.isFinite(diffMs)) return "Never seen";
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 30) {
    return d.toLocaleDateString(DEVICE_DATE_LOCALE, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  if (day > 0) return day === 1 ? "Yesterday" : `${day} days ago`;
  if (hr > 0) return `${hr}h ago`;
  if (min > 0) return `${min}m ago`;
  if (diffMs > STALE_ONLINE_MS) return `${sec}s ago`;
  return "Just now";
}

/** Compact hint for admin plan screen picker (linked date + last activity). */
export function formatDevicePlanAdded(device: Pick<Device, "created_at">): string {
  const linked = new Date(device.created_at).toLocaleDateString(DEVICE_DATE_LOCALE, {
    month: "short",
    day: "numeric",
  });
  return `Added ${linked}`;
}

export function formatDevicePlanActive(device: Pick<Device, "last_seen">): string {
  if (!device.last_seen) return "Active never";
  const last = formatDeviceLastSeen(device.last_seen).replace(/^Never seen$/, "never");
  return `Active ${last}`;
}

export function formatDevicePlanHint(device: Pick<Device, "created_at" | "last_seen">): string {
  return `${formatDevicePlanAdded(device)} · ${formatDevicePlanActive(device)}`;
}
