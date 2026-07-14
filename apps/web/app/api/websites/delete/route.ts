import { NextResponse, type NextRequest } from "next/server";
import { getRouteHandlerClientAuth } from "@/lib/auth/route-handler-client";
import { resolveDataOwnerId } from "@/lib/auth/resolve-data-owner";
import { deleteMediaObject } from "@/lib/object-storage/server";

export const runtime = "nodejs";

type WebsiteDeleteBody = {
  id?: string;
  ownerId?: string;
};

export async function DELETE(request: NextRequest) {
  const ctx = await getRouteHandlerClientAuth(request);
  if (!ctx.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (ctx.profile?.is_disabled && !ctx.staff) {
    return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  }

  let body: WebsiteDeleteBody;
  try {
    body = (await request.json()) as WebsiteDeleteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const websiteId = body.id?.trim();
  if (!websiteId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const isStaff = ctx.staff != null;
  const resolved = resolveDataOwnerId(
    ctx.user.id,
    ctx.staff,
    isStaff ? body.ownerId : ctx.user.id,
  );
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const { supabase } = ctx;
  const ownerId = resolved.ownerId;

  const { data: existing, error: fetchError } = await supabase
    .from("websites")
    .select("id, owner_id, storage_path, thumbnail_storage_path")
    .eq("id", websiteId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!existing || existing.owner_id !== ownerId) {
    return NextResponse.json({ error: "Website not found" }, { status: 404 });
  }

  const { count: playlistRefs, error: refError } = await supabase
    .from("playlist_items")
    .select("id", { count: "exact", head: true })
    .eq("website_id", websiteId);

  if (refError) {
    return NextResponse.json({ error: refError.message }, { status: 500 });
  }
  if ((playlistRefs ?? 0) > 0) {
    return NextResponse.json(
      { error: "This website is used in one or more playlists. Remove it from screens first." },
      { status: 409 },
    );
  }

  const { error: deleteError } = await supabase.from("websites").delete().eq("id", websiteId);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  for (const path of [existing.storage_path, existing.thumbnail_storage_path]) {
    if (!path) continue;
    try {
      await deleteMediaObject(ownerId, path);
    } catch {
      /* best effort */
    }
  }

  return NextResponse.json({ ok: true });
}
