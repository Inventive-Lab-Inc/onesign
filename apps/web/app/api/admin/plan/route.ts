import { NextResponse, type NextRequest } from "next/server";
import { parseUserId } from "@/lib/auth/resolve-data-owner";
import { getRouteHandlerStaffAuth } from "@/lib/auth/route-handler-staff";
import { isStaffWriter } from "@/lib/auth/staff-utils";
import { MIN_STORAGE_LIMIT_BYTES } from "@/lib/plan-quota";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { user, staff, supabase } = await getRouteHandlerStaffAuth();
  if (!user || !staff || !isStaffWriter(staff)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    userId?: string;
    deviceLimit?: number;
    storageLimitBytes?: number;
    activeDeviceIds?: string[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userId = parseUserId(body.userId);
  if (!userId) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  const deviceLimit = body.deviceLimit;
  if (typeof deviceLimit !== "number" || !Number.isInteger(deviceLimit) || deviceLimit < 1) {
    return NextResponse.json({ error: "deviceLimit must be an integer of at least 1" }, { status: 400 });
  }

  const storageLimitBytes = body.storageLimitBytes;
  if (
    typeof storageLimitBytes !== "number" ||
    !Number.isInteger(storageLimitBytes) ||
    storageLimitBytes < MIN_STORAGE_LIMIT_BYTES
  ) {
    return NextResponse.json(
      { error: `storageLimitBytes must be at least ${MIN_STORAGE_LIMIT_BYTES}` },
      { status: 400 },
    );
  }

  const activeDeviceIds = Array.isArray(body.activeDeviceIds)
    ? body.activeDeviceIds.map((id) => parseUserId(id)).filter((id): id is string => id != null)
    : null;

  if (activeDeviceIds && activeDeviceIds.length > deviceLimit) {
    return NextResponse.json({ error: "Too many active devices selected" }, { status: 400 });
  }

  const { error: deviceError } = await supabase.rpc("admin_set_device_limit", {
    p_user_id: userId,
    p_limit: deviceLimit,
    p_active_device_ids: activeDeviceIds && activeDeviceIds.length > 0 ? activeDeviceIds : null,
  });

  if (deviceError) {
    return NextResponse.json({ error: deviceError.message }, { status: 500 });
  }

  const { error: storageError } = await supabase.rpc("admin_set_storage_limit", {
    p_user_id: userId,
    p_limit_bytes: storageLimitBytes,
  });

  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
