import { NextResponse, type NextRequest } from "next/server";
import { isStaffWriter } from "@/lib/auth/staff-utils";
import { getRouteHandlerStaffAuth } from "@/lib/auth/route-handler-staff";

export const runtime = "nodejs";

const VALID_STATUSES = new Set(["pending", "reviewed", "invited", "dismissed"]);

export async function POST(request: NextRequest) {
  const { user, staff, supabase } = await getRouteHandlerStaffAuth();
  if (!user || !staff || !isStaffWriter(staff)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { id?: string; status?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = body.id?.trim();
  const status = body.status?.trim().toLowerCase();

  if (!id) {
    return NextResponse.json({ error: "Missing waitlist id" }, { status: 400 });
  }
  if (!status || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { error } = await supabase.rpc("admin_update_waitlist_status", {
    p_id: id,
    p_status: status,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
