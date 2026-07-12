import { NextResponse, type NextRequest } from "next/server";
import { parseUserId } from "@/lib/auth/resolve-data-owner";
import { getRouteHandlerStaffAuth } from "@/lib/auth/route-handler-staff";
import { isStaffWriter } from "@/lib/auth/staff-utils";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { user, staff } = await getRouteHandlerStaffAuth();
  if (!user || !staff || !isStaffWriter(staff)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { userId?: string; clientName?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userId = parseUserId(body.userId);
  if (!userId) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  const clientName = body.clientName?.trim() ?? "";
  if (!clientName) {
    return NextResponse.json({ error: "Client name is required" }, { status: 400 });
  }
  if (clientName.length > 120) {
    return NextResponse.json({ error: "Client name must be 120 characters or fewer" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const { data: existing, error: existingError } = await admin
    .from("profiles")
    .select("id, client_name")
    .eq("id", userId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({ client_name: clientName })
    .eq("id", userId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  const { error: metadataError } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: { full_name: clientName },
  });
  if (metadataError) {
    console.warn("[update-client] user_metadata", metadataError.message);
  }

  return NextResponse.json({
    ok: true,
    message: `Updated client name to “${clientName}”.`,
    clientName,
  });
}
