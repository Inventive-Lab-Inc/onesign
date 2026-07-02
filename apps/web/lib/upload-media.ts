import type { Media } from "@signage/types";
import { inferMediaFileType, isAcceptedSignageMime } from "@/lib/media";

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

function uploadFormDataWithProgress(
  url: string,
  formData: FormData,
  onProgress?: (loaded: number, total: number) => void,
): Promise<{ ok: boolean; payload: { media?: Media; error?: string } }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "text";

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(event.loaded, event.total);
      }
    };

    xhr.onload = () => {
      let payload: { media?: Media; error?: string };
      try {
        payload = JSON.parse(xhr.responseText) as { media?: Media; error?: string };
      } catch {
        resolve({ ok: false, payload: { error: "Invalid server response." } });
        return;
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, payload });
    };

    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(formData);
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

    const formData = new FormData();
    formData.append("file", file);
    formData.append("ownerId", ownerId);
    if (workspaceId) {
      formData.append("workspaceId", workspaceId);
    }

    let result: { ok: boolean; payload: { media?: Media; error?: string } };
    try {
      result = await uploadFormDataWithProgress("/api/media/upload", formData, (loaded, total) => {
        reportProgress(total > 0 ? Math.round((loaded / total) * 100) : 0);
      });
    } catch {
      errors.push(`${file.name}: network error during upload.`);
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

  const formData = new FormData();
  formData.append("file", file);
  formData.append("mediaId", mediaId);
  formData.append("ownerId", ownerId);

  let result: { ok: boolean; payload: { media?: Media; error?: string } };
  try {
    result = await uploadFormDataWithProgress("/api/media/replace", formData, (loaded, total) => {
      reportProgress(total > 0 ? Math.round((loaded / total) * 100) : 0);
    });
  } catch {
    return { media: null, error: "Network error during replace." };
  }

  if (!result.ok || !result.payload.media) {
    return { media: null, error: result.payload.error ?? "Replace failed." };
  }

  reportProgress(100);
  return { media: result.payload.media, error: null };
}

export { inferMediaFileType, isAcceptedSignageMime };
