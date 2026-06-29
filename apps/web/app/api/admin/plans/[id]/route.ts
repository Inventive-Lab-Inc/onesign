import { NextResponse, type NextRequest } from "next/server";
import { parseUserId } from "@/lib/auth/resolve-data-owner";
import { getRouteHandlerStaffAuth } from "@/lib/auth/route-handler-staff";
import { isStaffWriter } from "@/lib/auth/staff-utils";

export const runtime = "nodejs";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { user, staff, supabase } = await getRouteHandlerStaffAuth();
  if (!user || !staff || !isStaffWriter(staff)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: rawId } = await context.params;
  const id = parseUserId(rawId);
  if (!id) {
    return NextResponse.json({ error: "Invalid plan id" }, { status: 400 });
  }

  const { error } = await supabase.rpc("admin_delete_plan", { p_id: id });
  if (error) {
    const status = error.message.includes("plan_not_found") ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ ok: true });
}
