/**
 * One-time backfill: set media.size_bytes from S3/MinIO HEAD and reconcile storage limits.
 *
 * Usage (from apps/web with env loaded):
 *   npx tsx scripts/backfill-media-size-bytes.ts
 */
import { createClient } from "@supabase/supabase-js";
import { reconcileOwnerMediaSizes } from "../lib/plan/reconcile-owner-media-sizes";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: rows, error } = await supabase
    .from("media")
    .select("owner_id")
    .or("size_bytes.is.null,size_bytes.eq.0");

  if (error) throw error;

  const ownerIds = [...new Set((rows ?? []).map((row) => row.owner_id))];
  for (const ownerId of ownerIds) {
    await reconcileOwnerMediaSizes(ownerId);
  }

  console.log(`Reconciled media sizes for ${ownerIds.length} owner(s).`);

  const { data: profiles, error: profileError } = await supabase.from("profiles").select("id");
  if (profileError) throw profileError;

  for (const profile of profiles ?? []) {
    const { data: used } = await supabase.rpc("get_owner_storage_used", { p_owner_id: profile.id });
    const usedBytes = typeof used === "number" ? used : Number(used ?? 0);
    const limit = Math.max(2147483648, usedBytes);

    await supabase.from("profiles").update({ storage_limit_bytes: limit }).eq("id", profile.id);
  }

  console.log("Reconciled profile storage_limit_bytes.");
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
