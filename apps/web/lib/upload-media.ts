import type { Media } from "@signage/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inferMediaFileType, isAcceptedSignageMime, readVideoFileDurationSeconds } from "@/lib/media";
import { durationSecondsForStorage } from "@/lib/video-duration-probe";

export const MEDIA_UPLOAD_ACCEPT = {
  "image/jpeg": [],
  "image/png": [],
  "image/webp": [],
  "video/mp4": [],
  "video/webm": [],
} as const;

export async function uploadMediaFiles(
  supabase: SupabaseClient,
  ownerId: string,
  files: File[],
): Promise<{ uploaded: Media[]; errors: string[] }> {
  const uploaded: Media[] = [];
  const errors: string[] = [];

  for (const file of files) {
    if (!isAcceptedSignageMime(file.type)) {
      errors.push(`${file.name} is not a supported image/video type.`);
      continue;
    }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const objectPath = `${ownerId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("media").upload(objectPath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    if (uploadError) {
      errors.push(uploadError.message);
      continue;
    }
    const fileType = inferMediaFileType(file.type);
    const intrinsicSeconds =
      fileType === "video" ? durationSecondsForStorage(await readVideoFileDurationSeconds(file)) : null;
    const { data, error: insertError } = await supabase
      .from("media")
      .insert({
        owner_id: ownerId,
        storage_path: objectPath,
        file_type: fileType,
        original_filename: file.name,
        duration_seconds: intrinsicSeconds,
      })
      .select("*")
      .single();
    if (insertError) {
      errors.push(insertError.message);
      continue;
    }
    uploaded.push(data as Media);
  }

  return { uploaded, errors };
}
