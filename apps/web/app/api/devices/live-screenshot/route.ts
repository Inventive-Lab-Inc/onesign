import { NextResponse, type NextRequest } from "next/server";
import type { Device } from "@signage/types";
import { getRouteHandlerBearerAuth } from "@/lib/auth/route-handler-bearer";
import { putMediaObject } from "@/lib/object-storage/server";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  deviceLiveScreenshotObjectPath,
  MAX_DEVICE_LIVE_SCREENSHOT_BYTES,
} from "@/lib/upload-device-live-screenshot";

export const runtime = "nodejs";

const UPLOAD_RATE_LIMIT = 20;
const UPLOAD_RATE_WINDOW_MS = 60_000;

export async function POST(request: NextRequest) {
  const auth = await getRouteHandlerBearerAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rate = checkRateLimit(`device-live-screenshot:${auth.user.id}`, UPLOAD_RATE_LIMIT, UPLOAD_RATE_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) } },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const deviceId = formData.get("deviceId")?.toString()?.trim();
  if (!deviceId) {
    return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.type !== "image/webp") {
    return NextResponse.json({ error: "Use a WebP image." }, { status: 400 });
  }

  if (file.size > MAX_DEVICE_LIVE_SCREENSHOT_BYTES) {
    return NextResponse.json({ error: "Screenshot is too large." }, { status: 400 });
  }

  const { data: device, error: fetchError } = await auth.supabase
    .from("devices")
    .select("id, owner_id, registered_session_id, screenshot_requested_at")
    .eq("id", deviceId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!device?.owner_id || device.registered_session_id !== auth.user.id) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  if (!device.screenshot_requested_at) {
    return NextResponse.json({ error: "No screenshot request pending" }, { status: 409 });
  }

  const storagePath = deviceLiveScreenshotObjectPath(device.owner_id, device.id);
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await putMediaObject(
      device.owner_id,
      storagePath,
      buffer,
      "image/webp",
      "public, max-age=60, must-revalidate",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload to object storage failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const capturedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await auth.supabase
    .from("devices")
    .update({
      live_screenshot_at: capturedAt,
      screenshot_requested_at: null,
    })
    .eq("id", device.id)
    .select("id, live_screenshot_at, screenshot_requested_at")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    device: updated as Pick<Device, "id" | "live_screenshot_at" | "screenshot_requested_at">,
    storagePath,
  });
}
