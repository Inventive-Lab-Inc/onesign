import { NextResponse, type NextRequest } from "next/server";
import type { Media } from "@signage/types";
import { getRouteHandlerClientAuth } from "@/lib/auth/route-handler-client";
import { resolveDataOwnerId } from "@/lib/auth/resolve-data-owner";
import { fetchAccountOwnerId } from "@/lib/workspace/account-context";

export const runtime = "nodejs";

type MediaUpdateBody = {
  id?: string;
  ownerId?: string;
  original_filename?: string | null;
  description?: string | null;
  tags?: string[];
  display_from?: string | null;
  display_until?: string | null;
};

function normalizeTags(tags: unknown): string[] | undefined {
  if (tags === undefined) return undefined;
  if (!Array.isArray(tags)) return undefined;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    const trimmed = tag.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function parseOptionalTimestamp(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return undefined;
  return new Date(parsed).toISOString();
}

export async function PATCH(request: NextRequest) {
  const ctx = await getRouteHandlerClientAuth(request);
  if (!ctx.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (ctx.profile?.is_disabled && !ctx.staff) {
    return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  }

  let body: MediaUpdateBody;
  try {
    body = (await request.json()) as MediaUpdateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const mediaId = body.id?.trim();
  if (!mediaId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const isStaff = ctx.staff != null;
  const accountOwnerId = isStaff ? null : await fetchAccountOwnerId(ctx.supabase);
  const resolved = resolveDataOwnerId(
    ctx.user.id,
    ctx.staff,
    isStaff ? body.ownerId : ctx.user.id,
    accountOwnerId,
  );
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const update: Record<string, unknown> = {};

  if (body.original_filename !== undefined) {
    const title = body.original_filename?.trim() ?? "";
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    update.original_filename = title;
  }

  if (body.description !== undefined) {
    const description = body.description?.trim() ?? "";
    update.description = description.length > 0 ? description : null;
  }

  const tags = normalizeTags(body.tags);
  if (tags !== undefined) {
    update.tags = tags;
  }

  const displayFrom = parseOptionalTimestamp(body.display_from);
  if (displayFrom === undefined && body.display_from !== undefined && body.display_from !== null && body.display_from !== "") {
    return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
  }
  if (displayFrom !== undefined) {
    update.display_from = displayFrom;
  }

  const displayUntil = parseOptionalTimestamp(body.display_until);
  if (
    displayUntil === undefined &&
    body.display_until !== undefined &&
    body.display_until !== null &&
    body.display_until !== ""
  ) {
    return NextResponse.json({ error: "Invalid expiry date" }, { status: 400 });
  }
  if (displayUntil !== undefined) {
    update.display_until = displayUntil;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { supabase } = ctx;
  const effectiveOwnerId = resolved.ownerId;

  const { data: existing, error: fetchError } = await supabase
    .from("media")
    .select("id, owner_id")
    .eq("id", mediaId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!existing || existing.owner_id !== effectiveOwnerId) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const { data, error: updateError } = await supabase
    .from("media")
    .update(update)
    .eq("id", mediaId)
    .select("*")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ media: data as Media });
}
