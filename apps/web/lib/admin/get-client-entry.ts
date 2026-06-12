import type { AdminUserDirectoryEntry } from "@signage/types";
import { getOwnerStorageUsedBytes } from "@/lib/plan/reconcile-owner-media-sizes";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getAdminClientEntry(
  supabase: SupabaseClient,
  userId: string,
): Promise<AdminUserDirectoryEntry | null> {
  const { data, error } = await supabase.rpc("admin_get_client", { p_user_id: userId });
  if (error) return null;
  const rows = (data as AdminUserDirectoryEntry[]) ?? [];
  const entry = rows[0];
  if (!entry) return null;

  const storageUsedBytes = await getOwnerStorageUsedBytes(entry.id, supabase);
  return { ...entry, storage_used_bytes: storageUsedBytes };
}
