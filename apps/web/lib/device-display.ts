import type { Device, DeviceScreenOrientation, DeviceStatus } from "@signage/types";
import { effectiveDeviceStatus } from "@/lib/device-status";
import { normalizeDeviceScreenOrientation } from "@/lib/device-screen-orientation";
import { resolveDeviceDisplayName } from "@/lib/device-information";

export type DeviceDateFilter = "all" | "week" | "month" | "year";

export type DeviceSort =
  | "created-desc"
  | "created-asc"
  | "name-asc"
  | "name-desc"
  | "last-seen-desc"
  | "last-seen-asc";

export type DeviceFiltersState = {
  dateFilter: DeviceDateFilter;
  orientationFilter: DeviceScreenOrientation | "all";
  /** Empty = all statuses. Otherwise show screens matching any selected status. */
  statusFilters: DeviceStatus[];
  tagFilter: string;
};

export const DEFAULT_DEVICE_FILTERS: DeviceFiltersState = {
  dateFilter: "all",
  orientationFilter: "all",
  statusFilters: [],
  tagFilter: "",
};

export const DEVICE_SORT_OPTIONS: { id: DeviceSort; label: string }[] = [
  { id: "created-desc", label: "Date added (newest first)" },
  { id: "created-asc", label: "Date added (oldest first)" },
  { id: "name-asc", label: "Alphabetical (ascending)" },
  { id: "name-desc", label: "Alphabetical (descending)" },
  { id: "last-seen-desc", label: "Time last seen (newest first)" },
  { id: "last-seen-asc", label: "Time last seen (oldest first)" },
];

const DATE_CUTOFF_MS: Record<Exclude<DeviceDateFilter, "all">, number> = {
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

export function applyDeviceDateFilter(list: Device[], dateFilter: DeviceDateFilter): Device[] {
  if (dateFilter === "all") return list;
  const now = Date.now();
  const cutoffMs = DATE_CUTOFF_MS[dateFilter];
  return list.filter((device) => now - new Date(device.created_at).getTime() <= cutoffMs);
}

export function applyDeviceOrientationFilter(
  list: Device[],
  orientationFilter: DeviceScreenOrientation | "all",
): Device[] {
  if (orientationFilter === "all") return list;
  return list.filter(
    (device) => normalizeDeviceScreenOrientation(device.screen_orientation) === orientationFilter,
  );
}

export function applyDeviceStatusFilters(list: Device[], statusFilters: DeviceStatus[]): Device[] {
  if (statusFilters.length === 0) return list;
  const allowed = new Set(statusFilters);
  return list.filter((device) => allowed.has(effectiveDeviceStatus(device)));
}

export function applyDeviceTagFilter(list: Device[], tagFilter: string): Device[] {
  const query = tagFilter.trim().toLowerCase();
  if (!query) return list;
  return list.filter((device) =>
    (device.tags ?? []).some((tag) => tag.toLowerCase().includes(query)),
  );
}

export function applyDeviceSearchFilter<T extends Device>(list: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((device) => resolveDeviceDisplayName(device).toLowerCase().includes(q));
}

export function applyDeviceFilters<T extends Device>(list: T[], filters: DeviceFiltersState): T[] {
  return applyDeviceTagFilter(
    applyDeviceStatusFilters(
      applyDeviceOrientationFilter(applyDeviceDateFilter(list, filters.dateFilter), filters.orientationFilter),
      filters.statusFilters,
    ),
    filters.tagFilter,
  ) as T[];
}

export function sortDeviceList<T extends Device>(list: T[], sort: DeviceSort): T[] {
  const copy = [...list];
  switch (sort) {
    case "created-asc":
      return copy.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    case "name-asc":
      return copy.sort((a, b) => resolveDeviceDisplayName(a).localeCompare(resolveDeviceDisplayName(b)));
    case "name-desc":
      return copy.sort((a, b) => resolveDeviceDisplayName(b).localeCompare(resolveDeviceDisplayName(a)));
    case "last-seen-desc":
      return copy.sort((a, b) => lastSeenSortKey(b) - lastSeenSortKey(a));
    case "last-seen-asc":
      return copy.sort((a, b) => lastSeenSortKey(a) - lastSeenSortKey(b));
    case "created-desc":
    default:
      return copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
}

function lastSeenSortKey(device: Device): number {
  if (!device.last_seen) return 0;
  const ms = new Date(device.last_seen).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function deviceFiltersAreActive(filters: DeviceFiltersState): boolean {
  return (
    filters.dateFilter !== "all" ||
    filters.orientationFilter !== "all" ||
    filters.statusFilters.length > 0 ||
    filters.tagFilter.trim().length > 0
  );
}

export function collectDeviceTags(devices: Device[]): string[] {
  const tags = new Set<string>();
  for (const device of devices) {
    for (const tag of device.tags ?? []) {
      const trimmed = tag.trim();
      if (trimmed) tags.add(trimmed);
    }
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}
