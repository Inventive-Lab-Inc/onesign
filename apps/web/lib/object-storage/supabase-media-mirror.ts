import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Best-effort copy to Supabase Storage so TVs still on pre-MinIO APKs (v8 and below)
 * can load new uploads until the fleet finishes OTA to v9+.
 */
export async function mirrorMediaToSupabaseStorage(
  supabase: SupabaseClient,
  storagePath: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const normalized = storagePath.replace(/^\/+/, "");
  const { error } = await supabase.storage.from("media").upload(normalized, body, {
    contentType,
    upsert: true,
    cacheControl: "86400",
  });
  if (error) {
    throw new Error(`Supabase media mirror failed: ${error.message}`);
  }
}
