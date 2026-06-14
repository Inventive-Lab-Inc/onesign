import { NextResponse, type NextRequest } from "next/server";
import type { Device } from "@signage/types";
import { getRouteHandlerStaffAuth } from "@/lib/auth/route-handler-staff";
import { parseUserId, resolveDataOwnerId } from "@/lib/auth/resolve-data-owner";
import { deleteMediaObjectsUnderPrefix, putMediaObject } from "@/lib/object-storage/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { isTrialExpired } from "@/lib/trial";
import {
  buildDeviceThumbnailStoragePath,
  deviceThumbnailObjectPrefix,
  deviceThumbnailExtension,
  isAcceptedDeviceThumbnailMime,
  MAX_DEVICE_THUMBNAIL_BYTES,
} from "@/lib/upload-device-thumbnail";

export const runtime = "nodejs";

const UPLOAD_RATE_LIMIT = 30;
const UPLOAD_RATE_WINDOW_MS = 60_000;

async function resolveOwnerAndDevice(
  ctx: Awaited<ReturnType<typeof getRouteHandlerStaffAuth>>,
  requestedOwnerId: string | null | undefined,
  deviceIdRaw: string | null | undefined,
) {
  if (!ctx.user) {
    return { error: "Unauthorized", status: 401 } as const;
  }
  if (ctx.profile?.is_disabled && !ctx.staff) {
    return { error: "Account suspended", status: 403 } as const;
  }
  if (isTrialExpired(ctx.profile?.trial_ends_at) && !ctx.staff) {
    return { error: "Your trial has ended.", status: 403 } as const;
  }

  const isStaff = ctx.staff != null;
  const resolved = resolveDataOwnerId(
    ctx.user.id,
    ctx.staff,
    isStaff ? requestedOwnerId : ctx.user.id,
  );
  if ("error" in resolved) {
    return { error: resolved.error, status: resolved.status } as const;
  }

  const deviceId = parseUserId(deviceIdRaw);
  if (!deviceId) {
    return { error: "Missing or invalid deviceId", status: 400 } as const;
  }

  const { data: device, error: fetchError } = await ctx.supabase
    .from("devices")
    .select("id, owner_id, thumbnail_storage_path")
    .eq("id", deviceId)
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError.message, status: 500 } as const;
  }
  if (!device || device.owner_id !== resolved.ownerId) {
    return { error: "Device not found", status: 404 } as const;
  }

  return {
    supabase: ctx.supabase,
    ownerId: resolved.ownerId,
    device: device as Pick<Device, "id" | "owner_id" | "thumbnail_storage_path">,
  } as const;
}

export async function POST(request: NextRequest) {
  const ctx = await getRouteHandlerStaffAuth();
  if (!ctx.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = checkRateLimit(`device-thumbnail:${ctx.user.id}`, UPLOAD_RATE_LIMIT, UPLOAD_RATE_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) } },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const resolved = await resolveOwnerAndDevice(
    ctx,
    formData.get("ownerId")?.toString(),
    formData.get("deviceId")?.toString(),
  );
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (!isAcceptedDeviceThumbnailMime(file.type)) {
    return NextResponse.json({ error: "Use a JPEG, PNG, or WebP image." }, { status: 400 });
  }

  if (file.size > MAX_DEVICE_THUMBNAIL_BYTES) {
    return NextResponse.json(
      { error: `Thumbnail must be ${Math.round(MAX_DEVICE_THUMBNAIL_BYTES / 1024 / 1024)} MB or smaller.` },
      { status: 400 },
    );
  }

  const extension = deviceThumbnailExtension(file.type);
  if (!extension) {
    return NextResponse.json({ error: "Unsupported image type." }, { status: 400 });
  }

  const storagePath = buildDeviceThumbnailStoragePath(resolved.ownerId, resolved.device.id, extension);
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await putMediaObject(
      resolved.ownerId,
      storagePath,
      buffer,
      file.type,
      "public, max-age=3600, must-revalidate",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload to object storage failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const { data, error: updateError } = await resolved.supabase
    .from("devices")
    .update({ thumbnail_storage_path: storagePath })
    .eq("id", resolved.device.id)
    .select("id, thumbnail_storage_path")
    .single();

  if (updateError) {
    try {
      await deleteMediaObjectsUnderPrefix(
        resolved.ownerId,
        deviceThumbnailObjectPrefix(resolved.ownerId, resolved.device.id),
      );
    } catch (cleanupErr) {
      console.error("[devices/thumbnail] rollback cleanup failed", storagePath, cleanupErr);
    }
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  try {
    await deleteMediaObjectsUnderPrefix(
      resolved.ownerId,
      deviceThumbnailObjectPrefix(resolved.ownerId, resolved.device.id),
      storagePath,
    );
  } catch (cleanupErr) {
    console.error("[devices/thumbnail] previous thumbnail cleanup failed", cleanupErr);
  }

  return NextResponse.json({ device: data as Pick<Device, "id" | "thumbnail_storage_path"> });
}

export async function DELETE(request: NextRequest) {
  const ctx = await getRouteHandlerStaffAuth();

  let body: { deviceId?: string; ownerId?: string };
  try {
    body = (await request.json()) as { deviceId?: string; ownerId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const resolved = await resolveOwnerAndDevice(ctx, body.ownerId, body.deviceId);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const thumbPrefix = deviceThumbnailObjectPrefix(resolved.ownerId, resolved.device.id);

  try {
    await deleteMediaObjectsUnderPrefix(resolved.ownerId, thumbPrefix);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete from object storage failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  if (!resolved.device.thumbnail_storage_path) {
    return NextResponse.json({ ok: true, device: { id: resolved.device.id, thumbnail_storage_path: null } });
  }

  const { data, error: updateError } = await resolved.supabase
    .from("devices")
    .update({ thumbnail_storage_path: null })
    .eq("id", resolved.device.id)
    .select("id, thumbnail_storage_path")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, device: data as Pick<Device, "id" | "thumbnail_storage_path"> });
}
