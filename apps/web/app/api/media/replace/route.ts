import { NextResponse, type NextRequest } from "next/server";
import type { Media } from "@signage/types";
import { MAX_UPLOAD_FILE_BYTES } from "@/lib/plan-quota";
import { inferMediaFileType, isAcceptedSignageMime, readVideoFileDurationSeconds } from "@/lib/media";
import { deleteMediaObject, putMediaObject } from "@/lib/object-storage/server";
import { getRouteHandlerClientAuth } from "@/lib/auth/route-handler-client";
import { resolveDataOwnerId } from "@/lib/auth/resolve-data-owner";
import { fetchAccountOwnerId } from "@/lib/workspace/account-context";
import { isTrialExpired } from "@/lib/trial";
import { checkRateLimit } from "@/lib/rate-limit";
import { durationSecondsForStorage } from "@/lib/video-duration-probe";

export const runtime = "nodejs";

const REPLACE_RATE_LIMIT = 30;
const REPLACE_RATE_WINDOW_MS = 60_000;

export async function POST(request: NextRequest) {
  const ctx = await getRouteHandlerClientAuth(request);
  if (!ctx.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (ctx.profile?.is_disabled && !ctx.staff) {
    return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  }
  if (isTrialExpired(ctx.profile?.trial_ends_at) && !ctx.staff) {
    return NextResponse.json(
      { error: "Your trial has ended. Contact us to upgrade and continue uploading." },
      { status: 403 },
    );
  }

  const rate = checkRateLimit(`media-replace:${ctx.user.id}`, REPLACE_RATE_LIMIT, REPLACE_RATE_WINDOW_MS);
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

  const isStaff = ctx.staff != null;
  const requestedOwnerId = formData.get("ownerId")?.toString();
  const accountOwnerId = isStaff ? null : await fetchAccountOwnerId(ctx.supabase);
  const resolved = resolveDataOwnerId(
    ctx.user.id,
    ctx.staff,
    isStaff ? requestedOwnerId : ctx.user.id,
    accountOwnerId,
  );
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const mediaId = formData.get("mediaId")?.toString()?.trim();
  if (!mediaId) {
    return NextResponse.json({ error: "Missing mediaId" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (!isAcceptedSignageMime(file.type)) {
    return NextResponse.json({ error: `${file.name} is not a supported image/video type.` }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_FILE_BYTES) {
    return NextResponse.json(
      { error: `Each file must be ${Math.round(MAX_UPLOAD_FILE_BYTES / 1024 / 1024)} MB or smaller.` },
      { status: 400 },
    );
  }

  const { supabase } = ctx;
  const effectiveOwnerId = resolved.ownerId;

  const { data: existing, error: fetchError } = await supabase
    .from("media")
    .select("id, owner_id, storage_path, size_bytes")
    .eq("id", mediaId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!existing || existing.owner_id !== effectiveOwnerId) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const sizeDelta = file.size - (existing.size_bytes ?? 0);
  if (sizeDelta > 0) {
    const { error: quotaError } = await supabase.rpc("check_storage_quota", {
      p_owner_id: effectiveOwnerId,
      p_add_bytes: sizeDelta,
    });
    if (quotaError) {
      const message = quotaError.message.includes("storage_limit_reached")
        ? "Storage is full. Remove files from your library or ask your administrator to increase your plan."
        : quotaError.message;
      return NextResponse.json({ error: message }, { status: 403 });
    }
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const storagePath = `${effectiveOwnerId}/${crypto.randomUUID()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const oldStoragePath = existing.storage_path;

  try {
    await putMediaObject(effectiveOwnerId, storagePath, buffer, file.type);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload to object storage failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const fileType = inferMediaFileType(file.type);
  const intrinsicSeconds =
    fileType === "video" ? durationSecondsForStorage(await readVideoFileDurationSeconds(file)) : null;

  const { data, error: updateError } = await supabase
    .from("media")
    .update({
      storage_path: storagePath,
      file_type: fileType,
      original_filename: file.name,
      duration_seconds: intrinsicSeconds,
      size_bytes: file.size,
    })
    .eq("id", mediaId)
    .select("*")
    .single();

  if (updateError) {
    try {
      await deleteMediaObject(effectiveOwnerId, storagePath);
    } catch (cleanupErr) {
      console.error("[media/replace] orphan cleanup failed", storagePath, cleanupErr);
    }
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (oldStoragePath !== storagePath) {
    try {
      await deleteMediaObject(effectiveOwnerId, oldStoragePath);
    } catch (cleanupErr) {
      console.error("[media/replace] old object cleanup failed", oldStoragePath, cleanupErr);
    }
  }

  return NextResponse.json({ media: data as Media });
}
