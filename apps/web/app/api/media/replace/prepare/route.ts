import { NextResponse, type NextRequest } from "next/server";
import {
  authorizeMediaWrite,
  newMediaStoragePath,
  readUploadMeta,
  resolveUploadOwner,
  storageQuotaMessage,
} from "@/lib/media-direct-upload";
import { ensureMediaBucketCors, presignMediaPut } from "@/lib/object-storage/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await authorizeMediaWrite(request, "media-replace");
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

  const owner = await resolveUploadOwner(session.ctx, typeof body.ownerId === "string" ? body.ownerId : undefined);
  if ("response" in owner) return owner.response;

  const { data: existing, error: fetchError } = await session.ctx.supabase
    .from("media")
    .select("id, owner_id, size_bytes")
    .eq("id", mediaId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!existing || existing.owner_id !== owner.ownerId) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const sizeDelta = meta.sizeBytes - (existing.size_bytes ?? 0);
  if (sizeDelta > 0) {
    const { error: quotaError } = await session.ctx.supabase.rpc("check_storage_quota", {
      p_owner_id: owner.ownerId,
      p_add_bytes: sizeDelta,
    });
    if (quotaError) {
      return NextResponse.json({ error: storageQuotaMessage(quotaError.message) }, { status: 403 });
    }
  }

  const storagePath = newMediaStoragePath(owner.ownerId, meta.contentType);
  if (!storagePath) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  try {
    await ensureMediaBucketCors();
    const uploadUrl = await presignMediaPut(owner.ownerId, storagePath, meta.contentType);
    return NextResponse.json({ uploadUrl, storagePath, contentType: meta.contentType });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start upload";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
