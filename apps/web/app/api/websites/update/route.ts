import { NextResponse, type NextRequest } from "next/server";
import type { Website } from "@signage/types";
import { getRouteHandlerStaffAuth } from "@/lib/auth/route-handler-staff";
import { resolveDataOwnerId } from "@/lib/auth/resolve-data-owner";
import { normalizeMediaTags, fromDatetimeLocalValue } from "@/lib/media-information";
import { buildWebsitePlaybackUrl, normalizeWebsiteUrl } from "@/lib/website-playback";

export const runtime = "nodejs";

type WebsiteUpdateBody = {
  id?: string;
  ownerId?: string;
  name?: string;
  url?: string;
  description?: string | null;
  tags?: string[];
  zoom_level?: number;
  display_from?: string | null;
  display_until?: string | null;
};

function parseOptionalTimestamp(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return undefined;
  return new Date(parsed).toISOString();
}

export async function PATCH(request: NextRequest) {
  const ctx = await getRouteHandlerStaffAuth();
  if (!ctx.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (ctx.profile?.is_disabled && !ctx.staff) {
    return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  }

  let body: WebsiteUpdateBody;
  try {
    body = (await request.json()) as WebsiteUpdateBody;
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
    .select("*")
    .eq("id", websiteId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!existing || existing.owner_id !== ownerId) {
    return NextResponse.json({ error: "Website not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.name !== undefined) {
    const title = body.name.trim();
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    update.name = title;
  }

  if (body.description !== undefined) {
    const description = body.description?.trim() ?? "";
    update.description = description.length > 0 ? description : null;
  }

  if (body.tags !== undefined) {
    update.tags = normalizeMediaTags(body.tags);
  }

  if (body.zoom_level !== undefined) {
    const zoom = Number(body.zoom_level);
    if (!Number.isFinite(zoom) || zoom < 25 || zoom > 200) {
      return NextResponse.json({ error: "Zoom level must be between 25% and 200%" }, { status: 400 });
    }
    update.zoom_level = Math.round(zoom);
  }

  const displayFrom = body.display_from === undefined ? undefined : fromDatetimeLocalValue(body.display_from ?? "");
  if (displayFrom === undefined && body.display_from !== undefined && body.display_from !== null && body.display_from !== "") {
    return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
  }
  if (displayFrom !== undefined) {
    update.display_from = displayFrom;
  }

  const displayUntil = body.display_until === undefined ? undefined : fromDatetimeLocalValue(body.display_until ?? "");
  if (displayUntil === undefined && body.display_until !== undefined && body.display_until !== null && body.display_until !== "") {
    return NextResponse.json({ error: "Invalid expiry date" }, { status: 400 });
  }
  if (displayUntil !== undefined) {
    update.display_until = displayUntil;
  }

  if (body.url !== undefined && existing.source_type === "url") {
    const normalized = normalizeWebsiteUrl(body.url);
    if (!normalized) {
      return NextResponse.json({ error: "Please enter a valid website URL" }, { status: 400 });
    }
    update.url = normalized;
    update.playback_url = buildWebsitePlaybackUrl("url", { url: normalized });
    update.thumbnail_status = "pending";
  }

  const nextZoom = (update.zoom_level as number | undefined) ?? existing.zoom_level;
  if (existing.source_type === "html" && (update.zoom_level !== undefined)) {
    update.playback_url = buildWebsitePlaybackUrl("html", {
      websiteId: existing.id,
      zoomLevel: nextZoom,
    });
  }

  if (Object.keys(update).length <= 1) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error: updateError } = await supabase
    .from("websites")
    .update(update)
    .eq("id", websiteId)
    .select("*")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ website: data as Website });
}
