import { NextResponse, type NextRequest } from "next/server";
import type { Media } from "@signage/types";
import { inferMediaFileType } from "@/lib/media";
import {
  authorizeMediaWrite,
  readUploadMeta,
  resolveUploadOwner,
} from "@/lib/media-direct-upload";
import { deleteMediaObject, headMediaObjectSize } from "@/lib/object-storage/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await authorizeMediaWrite(request, "media-upload-finish");
  if (!session.ok) return session.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
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

  const storedSize = await headMediaObjectSize(owner.ownerId, storagePath);
  if (storedSize == null || storedSize !== meta.sizeBytes) {
    return NextResponse.json({ error: "Uploaded file is missing or the wrong size." }, { status: 400 });
  }

  const workspaceId = typeof body.workspaceId === "string" && body.workspaceId ? body.workspaceId : null;
  const fileType = inferMediaFileType(meta.contentType);

  const { data, error: insertError } = await session.ctx.supabase
    .from("media")
    .insert({
      owner_id: owner.ownerId,
      workspace_id: workspaceId,
      storage_path: storagePath,
      file_type: fileType,
      original_filename: meta.filename,
      duration_seconds: fileType === "video" ? meta.durationSeconds : null,
      size_bytes: meta.sizeBytes,
    })
    .select("*")
    .single();

  if (insertError) {
    try {
      await deleteMediaObject(owner.ownerId, storagePath);
    } catch (cleanupErr) {
      console.error("[media/upload] orphan cleanup failed", storagePath, cleanupErr);
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ media: data as Media });
}
