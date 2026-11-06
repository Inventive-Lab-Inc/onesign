import { NextResponse, type NextRequest } from "next/server";
import type { Media } from "@signage/types";
import { inferMediaFileType } from "@/lib/media";
import { authorizeMediaWrite, readUploadMeta, resolveUploadOwner } from "@/lib/media-direct-upload";
import { deleteMediaObject, headMediaObjectSize } from "@/lib/object-storage/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await authorizeMediaWrite(request, "media-replace-finish");
  if (!session.ok) return session.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const mediaId = typeof body.mediaId === "string" ? body.mediaId.trim() : "";
  if (!mediaId) {
    return NextResponse.json({ error: "Missing mediaId" }, { status: 400 });
  }

  const meta = readUploadMeta(body);
  if ("error" in meta) {
    return NextResponse.json({ error: meta.error }, { status: 400 });
  }

  const storagePath = typeof body.storagePath === "string" ? body.storagePath.trim() : "";
  if (!storagePath) {
    return NextResponse.json({ error: "Missing storage path" }, { status: 400 });
  }

  const owner = await resolveUploadOwner(session.ctx, typeof body.ownerId === "string" ? body.ownerId : undefined);
  if ("response" in owner) return owner.response;

  const { data: existing, error: fetchError } = await session.ctx.supabase
    .from("media")
    .select("id, owner_id, storage_path")
    .eq("id", mediaId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!existing || existing.owner_id !== owner.ownerId) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const storedSize = await headMediaObjectSize(owner.ownerId, storagePath);
  if (storedSize == null || storedSize !== meta.sizeBytes) {
    return NextResponse.json({ error: "Uploaded file is missing or the wrong size." }, { status: 400 });
  }

  const fileType = inferMediaFileType(meta.contentType);
  const oldStoragePath = existing.storage_path as string;

  const { data, error: updateError } = await session.ctx.supabase
    .from("media")
    .update({
      storage_path: storagePath,
      file_type: fileType,
      original_filename: meta.filename,
      duration_seconds: fileType === "video" ? meta.durationSeconds : null,
      size_bytes: meta.sizeBytes,
    })
    .eq("id", mediaId)
    .select("*")
    .single();

  if (updateError) {
    try {
      await deleteMediaObject(owner.ownerId, storagePath);
    } catch (cleanupErr) {
      console.error("[media/replace] orphan cleanup failed", storagePath, cleanupErr);
    }
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (oldStoragePath !== storagePath) {
    try {
      await deleteMediaObject(owner.ownerId, oldStoragePath);
    } catch (cleanupErr) {
      console.error("[media/replace] old object cleanup failed", oldStoragePath, cleanupErr);
    }
  }

  return NextResponse.json({ media: data as Media });
}
