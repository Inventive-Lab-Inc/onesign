import type { Device } from "@signage/types";

export const DEVICE_THUMBNAIL_ACCEPT = {
  "image/jpeg": [],
  "image/png": [],
  "image/webp": [],
} as const;

const IMAGE_MIMES = new Set(Object.keys(DEVICE_THUMBNAIL_ACCEPT));

export const MAX_DEVICE_THUMBNAIL_BYTES = 2 * 1024 * 1024;

export function isAcceptedDeviceThumbnailMime(mime: string): boolean {
  return IMAGE_MIMES.has(mime);
}

export function deviceThumbnailExtension(mime: string): string | null {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

export function deviceThumbnailObjectPrefix(ownerId: string, deviceId: string): string {
  return `${ownerId}/devices/${deviceId}/`;
}

export function buildDeviceThumbnailStoragePath(
  ownerId: string,
  deviceId: string,
  extension: string,
  fileId: string = crypto.randomUUID(),
): string {
  return `${deviceThumbnailObjectPrefix(ownerId, deviceId)}thumbnail-${fileId}.${extension}`;
}

export async function uploadDeviceThumbnail(
  deviceId: string,
  ownerId: string,
  file: File,
): Promise<{ thumbnailStoragePath: string | null; error: string | null }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("deviceId", deviceId);
  formData.append("ownerId", ownerId);

  let response: Response;
  try {
    response = await fetch("/api/devices/thumbnail", {
      method: "POST",
      body: formData,
    });
  } catch {
    return { thumbnailStoragePath: null, error: "Network error during upload." };
  }

  let payload: { device?: Pick<Device, "thumbnail_storage_path">; error?: string };
  try {
    payload = (await response.json()) as { device?: Pick<Device, "thumbnail_storage_path">; error?: string };
  } catch {
    return { thumbnailStoragePath: null, error: "Invalid server response." };
  }

  if (!response.ok || !payload.device?.thumbnail_storage_path) {
    return { thumbnailStoragePath: null, error: payload.error ?? "Upload failed." };
  }

  return { thumbnailStoragePath: payload.device.thumbnail_storage_path, error: null };
}

export async function removeDeviceThumbnail(
  deviceId: string,
  ownerId: string,
): Promise<{ error: string | null }> {
  let response: Response;
  try {
    response = await fetch("/api/devices/thumbnail", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, ownerId }),
    });
  } catch {
    return { error: "Network error while removing thumbnail." };
  }

  let payload: { error?: string };
  try {
    payload = (await response.json()) as { error?: string };
  } catch {
    return { error: "Invalid server response." };
  }

  if (!response.ok) {
    return { error: payload.error ?? "Unable to remove thumbnail." };
  }

  return { error: null };
}
