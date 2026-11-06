import { NextResponse, type NextRequest } from "next/server";
import {
  authorizeMediaWrite,
  newMediaStoragePath,
  readUploadMeta,
  resolveUploadOwner,
  storageQuotaMessage,
} from "@/lib/media-direct-upload";
import { presignMediaPut } from "@/lib/object-storage/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await authorizeMediaWrite(request, "media-upload");
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

  const owner = await resolveUploadOwner(session.ctx, typeof body.ownerId === "string" ? body.ownerId : undefined);
  if ("response" in owner) return owner.response;

  const { error: quotaError } = await session.ctx.supabase.rpc("check_storage_quota", {
    p_owner_id: owner.ownerId,
    p_add_bytes: meta.sizeBytes,
  });
  if (quotaError) {
    return NextResponse.json({ error: storageQuotaMessage(quotaError.message) }, { status: 403 });
  }

  const storagePath = newMediaStoragePath(owner.ownerId, meta.contentType);
  if (!storagePath) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  try {
    const uploadUrl = await presignMediaPut(owner.ownerId, storagePath, meta.contentType);
    return NextResponse.json({ uploadUrl, storagePath, contentType: meta.contentType });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start upload";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
