import { NextResponse, type NextRequest } from "next/server";
import type { Website } from "@signage/types";
import { getRouteHandlerClientAuth } from "@/lib/auth/route-handler-client";
import { resolveDataOwnerId } from "@/lib/auth/resolve-data-owner";
import { putMediaObject } from "@/lib/object-storage/server";
import { buildWebsitePlaybackUrl } from "@/lib/website-playback";

export const runtime = "nodejs";

const MAX_HTML_FILE_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const ctx = await getRouteHandlerClientAuth(request);
  if (!ctx.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (ctx.profile?.is_disabled && !ctx.staff) {
    return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const isStaff = ctx.staff != null;
  const requestedOwnerId = formData.get("ownerId")?.toString();
  const resolved = resolveDataOwnerId(
    ctx.user.id,
    ctx.staff,
    isStaff ? requestedOwnerId : ctx.user.id,
  );
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const name = formData.get("name")?.toString().trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing HTML file" }, { status: 400 });
  }

  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(".html") && !lowerName.endsWith(".htm")) {
    return NextResponse.json({ error: "Only .html files are supported" }, { status: 400 });
  }

  if (file.size > MAX_HTML_FILE_BYTES) {
    return NextResponse.json({ error: "HTML file must be 5 MB or smaller" }, { status: 400 });
  }

  const ownerId = resolved.ownerId;
  const websiteId = crypto.randomUUID();
  const extension = lowerName.endsWith(".htm") ? "htm" : "html";
  const storagePath = `${ownerId}/websites/${websiteId}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await putMediaObject(ownerId, storagePath, buffer, "text/html");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload to object storage failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const playbackUrl = buildWebsitePlaybackUrl("file", { storagePath });

  const { supabase } = ctx;
  const { data, error } = await supabase
    .from("websites")
    .insert({
      id: websiteId,
      owner_id: ownerId,
      name,
      source_type: "file",
      storage_path: storagePath,
      playback_url: playbackUrl,
      thumbnail_status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ website: data as Website });
}
