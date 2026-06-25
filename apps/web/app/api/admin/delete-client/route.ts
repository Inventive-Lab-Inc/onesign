import { NextResponse, type NextRequest } from "next/server";
import { parseUserId } from "@/lib/auth/resolve-data-owner";
import { getRouteHandlerStaffAuth } from "@/lib/auth/route-handler-staff";
import { isStaffWriter } from "@/lib/auth/staff-utils";
import { deleteMediaObjectsUnderPrefix } from "@/lib/object-storage/server";

export const runtime = "nodejs";

const CONFIRMATION_WORD = "delete";

export async function POST(request: NextRequest) {
  const { user, staff, supabase } = await getRouteHandlerStaffAuth();
  if (!user || !staff || !isStaffWriter(staff)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { userId?: string; confirm?: string };
  try {
    body = (await request.json()) as { userId?: string; confirm?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userId = parseUserId(body.userId);
  if (!userId) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  if (userId === user.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  if (body.confirm?.trim().toLowerCase() !== CONFIRMATION_WORD) {
    return NextResponse.json(
      { error: `Type "${CONFIRMATION_WORD}" to confirm deletion.` },
      { status: 400 },
    );
  }

  // Deletes account, owned devices, and all cascaded data atomically (also audits).
  const { error } = await supabase.rpc("admin_delete_client", { p_user_id: userId });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // The DB record is gone; now remove the client's stored objects. A failure here
  // only leaves orphaned bytes, so surface it as a warning rather than a hard error.
  let storageWarning: string | null = null;
  try {
    await deleteMediaObjectsUnderPrefix(userId, `${userId}/`);
  } catch (err) {
    storageWarning =
      err instanceof Error ? err.message : "Stored files could not be fully removed.";
    console.error("[delete-client] storage cleanup failed", { userId, error: storageWarning });
  }

  return NextResponse.json({ ok: true, storageWarning });
}
