import { NextResponse, type NextRequest } from "next/server";
import { parseUserId } from "@/lib/auth/resolve-data-owner";
import { getRouteHandlerStaffAuth } from "@/lib/auth/route-handler-staff";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const { user, staff, supabase } = await getRouteHandlerStaffAuth();
  if (!user || !staff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (staff.role !== "owner") {
    return NextResponse.json({ error: "Only account owners can manage admins" }, { status: 403 });
  }

  const { userId: rawUserId } = await context.params;
  const userId = parseUserId(rawUserId);
  if (!userId) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const { error } = await supabase.rpc("admin_remove_staff", { p_user_id: userId });
  if (error) {
    const status = error.message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  try {
    const admin = getSupabaseAdminClient();
    const { error: signOutError } = await admin.auth.admin.signOut(userId, "global");
    if (signOutError) {
      console.warn("[staff-remove] signOut", signOutError.message);
    }
  } catch (err) {
    console.warn("[staff-remove] signOut unavailable", err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ ok: true });
}
