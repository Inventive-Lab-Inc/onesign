import type { SupabaseClient } from "@supabase/supabase-js";
import { getObjectStorageServerConfig } from "@/lib/object-storage/env";
import { headMediaObjectSize } from "@/lib/object-storage/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

async function sumOwnerStorageUsed(supabase: SupabaseClient, ownerId: string): Promise<number> {
  const { data: used, error } = await supabase.rpc("get_owner_storage_used", { p_owner_id: ownerId });
  if (error) {
    const { data: mediaRows } = await supabase.from("media").select("size_bytes").eq("owner_id", ownerId);
    return (mediaRows ?? []).reduce(
      (sum, row) => sum + (typeof row.size_bytes === "number" ? row.size_bytes : 0),
      0,
    );
  }
  return typeof used === "number" ? used : Number(used ?? 0);
}

/** HEAD missing sizes from object storage and persist them on media rows. */
export async function reconcileOwnerMediaSizes(ownerId: string): Promise<number> {
  if (!getObjectStorageServerConfig()) {
    throw new Error("Object storage is not configured");
  }

  const supabase = getSupabaseAdminClient();
  const { data: rows, error } = await supabase
    .from("media")
    .select("id, owner_id, storage_path, size_bytes")
    .eq("owner_id", ownerId)
    .or("size_bytes.is.null,size_bytes.eq.0");

  if (error) throw error;

  for (const row of rows ?? []) {
    const size = await headMediaObjectSize(row.owner_id, row.storage_path);
    if (size == null || size <= 0) continue;

    const { error: updateError } = await supabase
      .from("media")
      .update({ size_bytes: size })
      .eq("id", row.id);

    if (updateError) {
      console.warn("[reconcileOwnerMediaSizes] update failed", row.id, updateError.message);
    }
  }

  return sumOwnerStorageUsed(supabase, ownerId);
}

/**
 * Returns tracked storage usage for an owner. When DB rows lack size_bytes, fills them
 * from the configured S3/MinIO bucket before summing.
 */
export async function getOwnerStorageUsedBytes(
  ownerId: string,
  fallbackSupabase?: SupabaseClient,
): Promise<number> {
  let admin: SupabaseClient | null = null;
  try {
    admin = getSupabaseAdminClient();
  } catch {
    admin = null;
  }

  const readClient = admin ?? fallbackSupabase;
  if (!readClient) return 0;

  const { count, error: countError } = await readClient
    .from("media")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .or("size_bytes.is.null,size_bytes.eq.0");

  if (countError) {
    console.warn("[getOwnerStorageUsedBytes] count", countError.message);
    return sumOwnerStorageUsed(readClient, ownerId);
  }

  if ((count ?? 0) > 0 && getObjectStorageServerConfig() && admin) {
    try {
      return await reconcileOwnerMediaSizes(ownerId);
    } catch (err) {
      console.warn("[getOwnerStorageUsedBytes] reconcile", err instanceof Error ? err.message : err);
    }
  }

  return sumOwnerStorageUsed(readClient, ownerId);
}
