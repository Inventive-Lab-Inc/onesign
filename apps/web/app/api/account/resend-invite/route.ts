import { NextResponse, type NextRequest } from "next/server";
import { getRouteHandlerAccountAdminAuth } from "@/lib/auth/route-handler-account-admin";
import { sendAccountMemberInviteEmail } from "@/lib/auth/send-account-invite-email";
import { InviteUserError } from "@/lib/auth/invite-user";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { user, canAdminAccount } = await getRouteHandlerAccountAdminAuth();
  if (!user || !canAdminAccount) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { email?: string; displayName?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
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
