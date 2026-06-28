import type { Media } from "@signage/types";
import { inferMediaFileType, isAcceptedSignageMime } from "@/lib/media";

export const MEDIA_UPLOAD_ACCEPT = {
  "image/jpeg": [],
  "image/png": [],
  "image/webp": [],
  "video/mp4": [],
  "video/webm": [],
} as const;

export async function uploadMediaFiles(
  files: File[],
  ownerId: string,
  workspaceId?: string | null,
): Promise<{ uploaded: Media[]; errors: string[] }> {
  const uploaded: Media[] = [];
  const errors: string[] = [];

  for (const file of files) {
    if (!isAcceptedSignageMime(file.type)) {
      errors.push(`${file.name} is not a supported image/video type.`);
      continue;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("ownerId", ownerId);
    if (workspaceId) {
      formData.append("workspaceId", workspaceId);
    }

    let response: Response;
    try {
      response = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });
    } catch {
      errors.push(`${file.name}: network error during upload.`);
      continue;
    }

    let payload: { media?: Media; error?: string };
    try {
      payload = (await response.json()) as { media?: Media; error?: string };
    } catch {
      errors.push(`${file.name}: invalid server response.`);
      continue;
    }

    if (!response.ok || !payload.media) {
      errors.push(payload.error ?? `${file.name}: upload failed.`);
      continue;
    }

    uploaded.push(payload.media);
  }

  return { uploaded, errors };
}

export async function replaceMediaFile(
  file: File,
  mediaId: string,
  ownerId: string,
): Promise<{ media: Media | null; error: string | null }> {
  if (!isAcceptedSignageMime(file.type)) {
    return { media: null, error: `${file.name} is not a supported image/video type.` };
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("mediaId", mediaId);
  formData.append("ownerId", ownerId);

  let response: Response;
  try {
    response = await fetch("/api/media/replace", {
      method: "POST",
      body: formData,
    });
  } catch {
    return { media: null, error: "Network error during replace." };
  }

  let payload: { media?: Media; error?: string };
  try {
    payload = (await response.json()) as { media?: Media; error?: string };
  } catch {
    return { media: null, error: "Invalid server response." };
  }

  if (!response.ok || !payload.media) {
    return { media: null, error: payload.error ?? "Replace failed." };
  }

  return { media: payload.media, error: null };
}

export { inferMediaFileType, isAcceptedSignageMime };
