/** Shared plan quota constants and formatting. */

export const DEFAULT_DEVICE_LIMIT = 1;
export const DEFAULT_TRIAL_DAYS = 7;
export const DEFAULT_STORAGE_LIMIT_BYTES = 500 * 1024 ** 2;
export const MIN_STORAGE_LIMIT_BYTES = 1024 ** 2;
export const MAX_UPLOAD_FILE_BYTES = 500 * 1024 ** 2;

export type StorageUnit = "MB" | "GB";

const STORAGE_UNIT_BYTES: Record<StorageUnit, number> = {
  MB: 1024 ** 2,
  GB: 1024 ** 3,
};

export function formatStorageBytes(bytes: number, digits = 1): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(digits)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(digits)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(digits)} GB`;
}

export function parseStorageInput(value: string, unit: StorageUnit): number | null {
  const trimmed = value.trim().replace(/,/g, "");
  if (!trimmed) return null;
  const n = Number.parseFloat(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * STORAGE_UNIT_BYTES[unit]);
}

export function bytesToStorageUnit(bytes: number, unit: StorageUnit): number {
  return bytes / STORAGE_UNIT_BYTES[unit];
}

export function storageUsageRatio(usedBytes: number, limitBytes: number): number {
  if (limitBytes <= 0) return 0;
  return Math.min(1, Math.max(0, usedBytes / limitBytes));
}

export function storageUsageTone(ratio: number): "ok" | "warn" | "full" {
  if (ratio >= 1) return "full";
  if (ratio >= 0.85) return "warn";
  return "ok";
}

export function deviceUsageRatio(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(1, Math.max(0, used / limit));
}

export function deviceUsageTone(ratio: number): "ok" | "warn" | "full" {
  if (ratio >= 1) return "full";
  if (ratio >= 0.85) return "warn";
  return "ok";
}

export interface PlanQuotaSnapshot {
  deviceLimit: number;
  deviceCount: number;
  storageLimitBytes: number;
  storageUsedBytes: number;
  accountDisabled?: boolean;
  trialEndsAt?: string | null;
  trialExpired?: boolean;
  planKind?: string | null;
  isOnTrial?: boolean;
}

export function isStorageFull(snapshot: Pick<PlanQuotaSnapshot, "storageLimitBytes" | "storageUsedBytes">): boolean {
  return snapshot.storageUsedBytes >= snapshot.storageLimitBytes;
}

export function isDeviceLinkingFull(snapshot: Pick<PlanQuotaSnapshot, "deviceLimit" | "deviceCount">): boolean {
  return snapshot.deviceCount >= snapshot.deviceLimit;
}
