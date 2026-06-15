import { NextResponse, type NextRequest } from "next/server";
import type { Website, WebsiteSourceType } from "@signage/types";
import { getRouteHandlerStaffAuth } from "@/lib/auth/route-handler-staff";
import { resolveDataOwnerId } from "@/lib/auth/resolve-data-owner";
import { buildWebsitePlaybackUrl, normalizeWebsiteUrl } from "@/lib/website-playback";

export const runtime = "nodejs";

type WebsiteCreateBody = {
  ownerId?: string;
  name?: string;
  sourceType?: WebsiteSourceType;
  url?: string;
  htmlContent?: string;
};

export async function POST(request: NextRequest) {
  const ctx = await getRouteHandlerStaffAuth();
  if (!ctx.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (ctx.profile?.is_disabled && !ctx.staff) {
    return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  }

  let body: WebsiteCreateBody;
  try {
    body = (await request.json()) as WebsiteCreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const sourceType = body.sourceType;
  if (sourceType !== "url" && sourceType !== "html") {
    return NextResponse.json({ error: "Invalid source type" }, { status: 400 });
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

  let url: string | null = null;
  let htmlContent: string | null = null;

  if (sourceType === "url") {
    const normalized = normalizeWebsiteUrl(body.url ?? "");
    if (!normalized) {
      return NextResponse.json({ error: "Please enter a valid website URL" }, { status: 400 });
    }
    url = normalized;
  } else {
    htmlContent = body.htmlContent?.trim() ?? "";
    if (!htmlContent) {
      return NextResponse.json({ error: "HTML content is required" }, { status: 400 });
    }
  }

  const websiteId = crypto.randomUUID();
  let playbackUrl: string;
  try {
    playbackUrl =
      sourceType === "url"
        ? buildWebsitePlaybackUrl("url", { url })
        : buildWebsitePlaybackUrl("html", { websiteId, zoomLevel: 100 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to build playback URL";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("websites")
    .insert({
      id: websiteId,
      owner_id: ownerId,
      name,
      source_type: sourceType,
      url,
      html_content: htmlContent,
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
