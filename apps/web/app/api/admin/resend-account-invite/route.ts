import { NextResponse, type NextRequest } from "next/server";
import { parseUserId } from "@/lib/auth/resolve-data-owner";
import { getRouteHandlerStaffAuth } from "@/lib/auth/route-handler-staff";
import { isStaffWriter } from "@/lib/auth/staff-utils";
import { sendAccountMemberInviteEmail } from "@/lib/auth/send-account-invite-email";
import { InviteUserError } from "@/lib/auth/invite-user";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { user, staff, supabase } = await getRouteHandlerStaffAuth();
  if (!user || !staff || !isStaffWriter(staff)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { accountId?: string; email?: string; displayName?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const accountId = parseUserId(body.accountId);
  if (!accountId) {
    return NextResponse.json({ error: "Invalid accountId" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const { data: pending, error: pendingError } = await supabase
    .from("account_invitations")
    .select("id")
    .eq("account_id", accountId)
    .eq("status", "pending")
    .ilike("email", email)
    .maybeSingle();

  if (pendingError) {
    return NextResponse.json({ error: pendingError.message }, { status: 400 });
  }
  if (!pending) {
    return NextResponse.json({ error: "No pending invitation found for this email" }, { status: 404 });
  }

  try {
    const result = await sendAccountMemberInviteEmail({
      email,
      displayName: body.displayName?.trim() || undefined,
    });

    if (result.kind === "already_active") {
      return NextResponse.json({
        ok: true,
        message: "This user already has an active account. They can sign in directly.",
      });
    }

    if (result.kind === "not_needed") {
      return NextResponse.json({ ok: true, message: "No invitation email was required." });
    }

    return NextResponse.json({
      ok: true,
      message: result.resent ? `Invitation resent to ${email}.` : `Invitation sent to ${email}.`,
    });
  } catch (err) {
    const message =
      err instanceof InviteUserError ? err.message : err instanceof Error ? err.message : "Could not resend invitation";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
