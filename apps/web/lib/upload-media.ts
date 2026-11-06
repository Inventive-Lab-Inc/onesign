import type { Media } from "@signage/types";
import { inferMediaFileType, isAcceptedSignageMime, readVideoFileDurationSeconds } from "@/lib/media";
import { durationSecondsForStorage } from "@/lib/video-duration-probe";

export const MEDIA_UPLOAD_ACCEPT = {
  "image/jpeg": [],
  "image/png": [],
  "image/webp": [],
  "video/mp4": [],
  "video/webm": [],
} as const;

export type MediaUploadProgress = {
  currentFileIndex: number;
  totalFiles: number;
  currentFileName: string;
  currentFilePercent: number;
  overallPercent: number;
};

export function computeOverallUploadPercent(
  completedFiles: number,
  totalFiles: number,
  currentFilePercent: number,
): number {
  if (totalFiles <= 0) return 0;
  const overall = ((completedFiles + currentFilePercent / 100) / totalFiles) * 100;
  return Math.min(100, Math.max(0, Math.round(overall)));
}

function putFileWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded, event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`Storage rejected the file (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(file);
  });
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<{ ok: boolean; payload: T & { error?: string } }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let payload: T & { error?: string };
  try {
    payload = (await response.json()) as T & { error?: string };
  } catch {
    return { ok: false, payload: { error: "Invalid server response." } as T & { error?: string } };
  }
  return { ok: response.ok, payload };
}

async function uploadFileDirect(
  file: File,
  prepareUrl: string,
  finishUrl: string,
  extra: Record<string, unknown>,
  onProgress?: (loaded: number, total: number) => void,
): Promise<{ ok: boolean; payload: { media?: Media; error?: string } }> {
  const durationSeconds =
    inferMediaFileType(file.type) === "video"
      ? durationSecondsForStorage(await readVideoFileDurationSeconds(file))
      : null;

  const prepared = await postJson<{ uploadUrl?: string; storagePath?: string; contentType?: string }>(prepareUrl, {
    filename: file.name,
    contentType: file.type,
    sizeBytes: file.size,
    durationSeconds,
    ...extra,
  });
  if (!prepared.ok || !prepared.payload.uploadUrl || !prepared.payload.storagePath) {
    return { ok: false, payload: { error: prepared.payload.error ?? "Could not start upload." } };
  }

  await putFileWithProgress(
    prepared.payload.uploadUrl,
    file,
    prepared.payload.contentType ?? file.type,
    onProgress,
  );

  return postJson<{ media?: Media }>(finishUrl, {
    filename: file.name,
    contentType: file.type,
    sizeBytes: file.size,
    durationSeconds,
    storagePath: prepared.payload.storagePath,
    ...extra,
  });
}

export async function uploadMediaFiles(
  files: File[],
  ownerId: string,
  workspaceId?: string | null,
  onProgress?: (progress: MediaUploadProgress) => void,
): Promise<{ uploaded: Media[]; errors: string[] }> {
  const uploaded: Media[] = [];
  const errors: string[] = [];
  const validFiles = files.filter((file) => isAcceptedSignageMime(file.type));

  for (const file of files) {
    if (!isAcceptedSignageMime(file.type)) {
      errors.push(`${file.name} is not a supported image/video type.`);
    }
  }

  const totalFiles = validFiles.length;
  let completedFiles = 0;

  for (let index = 0; index < validFiles.length; index++) {
    const file = validFiles[index]!;

    const reportProgress = (currentFilePercent: number) => {
      onProgress?.({
        currentFileIndex: index,
        totalFiles,
        currentFileName: file.name,
        currentFilePercent,
        overallPercent: computeOverallUploadPercent(completedFiles, totalFiles, currentFilePercent),
      });
    };

    reportProgress(0);

    let result: { ok: boolean; payload: { media?: Media; error?: string } };
    try {
      result = await uploadFileDirect(
        file,
        "/api/media/upload/prepare",
        "/api/media/upload/finish",
        { ownerId, ...(workspaceId ? { workspaceId } : {}) },
        (loaded, total) => {
          reportProgress(total > 0 ? Math.round((loaded / total) * 100) : 0);
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "network error during upload.";
      errors.push(`${file.name}: ${message}`);
      completedFiles++;
      continue;
    }

    if (!result.ok || !result.payload.media) {
      errors.push(result.payload.error ?? `${file.name}: upload failed.`);
      completedFiles++;
      continue;
    }

    uploaded.push(result.payload.media);
    completedFiles++;
    reportProgress(100);
  }

  return { uploaded, errors };
}

export async function replaceMediaFile(
  file: File,
  mediaId: string,
  ownerId: string,
  onProgress?: (progress: MediaUploadProgress) => void,
): Promise<{ media: Media | null; error: string | null }> {
  if (!isAcceptedSignageMime(file.type)) {
    return { media: null, error: `${file.name} is not a supported image/video type.` };
  }

  const reportProgress = (currentFilePercent: number) => {
    onProgress?.({
      currentFileIndex: 0,
      totalFiles: 1,
      currentFileName: file.name,
      currentFilePercent,
      overallPercent: currentFilePercent,
    });
  };

  reportProgress(0);

  let result: { ok: boolean; payload: { media?: Media; error?: string } };
  try {
    result = await uploadFileDirect(
      file,
      "/api/media/replace/prepare",
      "/api/media/replace/finish",
      { mediaId, ownerId },
      (loaded, total) => {
        reportProgress(total > 0 ? Math.round((loaded / total) * 100) : 0);
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error during replace.";
    return { media: null, error: message };
  }

  if (!result.ok || !result.payload.media) {
    return { media: null, error: result.payload.error ?? "Replace failed." };
  }

  reportProgress(100);
  return { media: result.payload.media, error: null };
}

export { inferMediaFileType, isAcceptedSignageMime };
