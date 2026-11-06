import { NextResponse, type NextRequest } from "next/server";
import { getRouteHandlerClientAuth } from "@/lib/auth/route-handler-client";
import { resolveDataOwnerId } from "@/lib/auth/resolve-data-owner";
import { fetchAccountOwnerId } from "@/lib/workspace/account-context";
import { isTrialExpired } from "@/lib/trial";
import { checkRateLimit } from "@/lib/rate-limit";
import { isAcceptedSignageMime } from "@/lib/media";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export function storageQuotaMessage(message: string): string {
  return message.includes("storage_limit_reached")
    ? "Storage is full. Remove files from your library or ask your administrator to increase your plan."
    : message;
}

export function extensionForMime(mime: string): string | null {
  return EXTENSION_BY_MIME[mime] ?? null;
}

export function newMediaStoragePath(ownerId: string, mime: string): string | null {
  const extension = extensionForMime(mime);
  if (!extension) return null;
  return `${ownerId}/${crypto.randomUUID()}.${extension}`;
}

type AuthContext = Awaited<ReturnType<typeof getRouteHandlerClientAuth>>;

type UploadSession =
  | { ok: true; ctx: AuthContext & { user: NonNullable<AuthContext["user"]> } }
  | { ok: false; response: NextResponse };

export async function authorizeMediaWrite(request: NextRequest, rateKey: string): Promise<UploadSession> {
  const ctx = await getRouteHandlerClientAuth(request);
  if (!ctx.user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (ctx.profile?.is_disabled && !ctx.staff) {
    return { ok: false, response: NextResponse.json({ error: "Account suspended" }, { status: 403 }) };
  }
  if (isTrialExpired(ctx.profile?.trial_ends_at) && !ctx.staff) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Your trial has ended. Contact us to upgrade and continue uploading." },
        { status: 403 },
      ),
    };
  }

  const rate = checkRateLimit(`${rateKey}:${ctx.user.id}`, 30, 60_000);
  if (!rate.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Too many uploads. Please wait a moment and try again." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) } },
      ),
    };
  }

  return { ok: true, ctx: { ...ctx, user: ctx.user } };
}

export async function resolveUploadOwner(
  ctx: AuthContext & { user: NonNullable<AuthContext["user"]> },
  requestedOwnerId: string | undefined,
): Promise<{ ownerId: string } | { response: NextResponse }> {
  const isStaff = ctx.staff != null;
  const accountOwnerId = isStaff ? null : await fetchAccountOwnerId(ctx.supabase);
  const resolved = resolveDataOwnerId(
    ctx.user.id,
    ctx.staff,
    isStaff ? requestedOwnerId : ctx.user.id,
    accountOwnerId,
  );
  if ("error" in resolved) {
    return { response: NextResponse.json({ error: resolved.error }, { status: resolved.status }) };
  }
  return { ownerId: resolved.ownerId };
}

export function readUploadMeta(body: Record<string, unknown>): {
  filename: string;
  contentType: string;
  sizeBytes: number;
  durationSeconds: number | null;
} | { error: string } {
  const filename = typeof body.filename === "string" ? body.filename.trim() : "";
  const contentType = typeof body.contentType === "string" ? body.contentType.trim() : "";
  const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : Number.NaN;
  const durationRaw = body.durationSeconds;
  const durationSeconds =
    typeof durationRaw === "number" && Number.isFinite(durationRaw) && durationRaw >= 1
      ? Math.round(durationRaw)
      : null;

  if (!filename) return { error: "Missing filename" };
  if (!isAcceptedSignageMime(contentType)) return { error: `${filename} is not a supported image/video type.` };
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return { error: "Missing file size" };
  return { filename: filename.slice(0, 240), contentType, sizeBytes: Math.round(sizeBytes), durationSeconds };
}
