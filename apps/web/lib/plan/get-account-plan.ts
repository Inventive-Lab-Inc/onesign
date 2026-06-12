import type { PlanQuotaSnapshot } from "@/lib/plan-quota";
import { DEFAULT_STORAGE_LIMIT_BYTES } from "@/lib/plan-quota";
import { getOwnerStorageUsedBytes } from "@/lib/plan/reconcile-owner-media-sizes";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getAccountPlanSnapshot(
  supabase: SupabaseClient,
  userId: string,
): Promise<PlanQuotaSnapshot> {
  const [{ data: profileFull, error: profileFullError }, { count, error: deviceError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("device_limit, storage_limit_bytes")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("devices").select("id", { count: "exact", head: true }).eq("owner_id", userId),
    ]);

  let deviceLimit = 1;
  let storageLimitBytes = DEFAULT_STORAGE_LIMIT_BYTES;

  if (!profileFullError && profileFull) {
    deviceLimit = profileFull.device_limit ?? 1;
    storageLimitBytes = profileFull.storage_limit_bytes ?? DEFAULT_STORAGE_LIMIT_BYTES;
  } else {
    if (profileFullError) {
      console.warn("[getAccountPlanSnapshot] profile", profileFullError.message);
    }
    const { data: profileCore } = await supabase
      .from("profiles")
      .select("device_limit")
      .eq("id", userId)
      .maybeSingle();
    deviceLimit = profileCore?.device_limit ?? 1;
  }

  const storageUsedBytes = await getOwnerStorageUsedBytes(userId, supabase);

  if (deviceError) {
    console.warn("[getAccountPlanSnapshot] devices", deviceError.message);
  }

  return {
    deviceLimit,
    deviceCount: count ?? 0,
    storageLimitBytes,
    storageUsedBytes,
  };
}

export function planSnapshotFromAdminEntry(entry: {
  device_count: number;
  device_limit: number;
  storage_used_bytes: number;
  storage_limit_bytes: number;
}): PlanQuotaSnapshot {
  return {
    deviceCount: Number(entry.device_count),
    deviceLimit: entry.device_limit,
    storageUsedBytes: Number(entry.storage_used_bytes),
    storageLimitBytes: Number(entry.storage_limit_bytes),
  };
}
