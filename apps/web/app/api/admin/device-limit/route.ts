import { NextResponse, type NextRequest } from "next/server";
import { parseUserId } from "@/lib/auth/resolve-data-owner";
import { getRouteHandlerStaffAuth } from "@/lib/auth/route-handler-staff";
import { isStaffWriter } from "@/lib/auth/staff-utils";

export const runtime = "nodejs";

/** @deprecated Prefer POST /api/admin/plan */
export async function POST(request: NextRequest) {
  const { user, staff, supabase } = await getRouteHandlerStaffAuth();
  if (!user || !staff || !isStaffWriter(staff)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { userId?: string; deviceLimit?: number; activeDeviceIds?: string[] };
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

  const activeDeviceIds = Array.isArray(body.activeDeviceIds)
    ? body.activeDeviceIds.map((id) => parseUserId(id)).filter((id): id is string => id != null)
    : null;

  const { error } = await supabase.rpc("admin_set_device_limit", {
    p_user_id: userId,
    p_limit: deviceLimit,
    p_active_device_ids: activeDeviceIds && activeDeviceIds.length > 0 ? activeDeviceIds : null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
