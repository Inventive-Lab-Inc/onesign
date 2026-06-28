import { NextResponse, type NextRequest } from "next/server";
import type { WorkspacePermission, WorkspaceRole } from "@signage/types";
import { getRouteHandlerAccountAdminAuth } from "@/lib/auth/route-handler-account-admin";
import { sendAccountMemberInviteEmail } from "@/lib/auth/send-account-invite-email";
import { InviteUserError } from "@/lib/auth/invite-user";
import { friendlyWorkspaceError } from "@/lib/workspace/error-messages";

export const runtime = "nodejs";

type WorkspaceRolePayload = {
  workspace_id: string;
  role: WorkspaceRole;
  permissions?: WorkspacePermission[];
};

export async function POST(request: NextRequest) {
  const { supabase, user, canAdminAccount } = await getRouteHandlerAccountAdminAuth();
  if (!user || !canAdminAccount) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    email?: string;
    firstName?: string;
    lastName?: string;
    roles?: WorkspaceRolePayload[];
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const roles = (body.roles ?? []).map((entry) => ({
    workspace_id: entry.workspace_id,
    role: entry.role,
    permissions: entry.role === "custom" ? (entry.permissions ?? []) : [],
  }));

  const { error: inviteError } = await supabase.rpc("invite_account_user", {
    p_email: email,
    p_first_name: body.firstName?.trim() || null,
    p_last_name: body.lastName?.trim() || null,
    p_roles: roles,
  });

  if (inviteError) {
    return NextResponse.json({ error: friendlyWorkspaceError(inviteError.message) }, { status: 400 });
  }

  const displayName = [body.firstName?.trim(), body.lastName?.trim()].filter(Boolean).join(" ") || undefined;

  try {
    const emailResult = await sendAccountMemberInviteEmail({ email, displayName });

    if (emailResult.kind === "already_active") {
      return NextResponse.json({
        ok: true,
        emailSent: false,
        message: "User added to your account. They can sign in with their existing password.",
      });
    }

    if (emailResult.kind === "not_needed") {
      return NextResponse.json({ ok: true, emailSent: false, message: "Invitation saved." });
    }

    return NextResponse.json({
      ok: true,
      emailSent: true,
      message: emailResult.resent ? `Invitation resent to ${email}.` : `Invitation sent to ${email}.`,
    });
  } catch (err) {
    if (err instanceof InviteUserError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Could not send invitation email";
    return NextResponse.json(
      {
        ok: true,
        emailSent: false,
        message: `User invited, but the email could not be sent (${message}). Try resending from the Users tab.`,
      },
      { status: 200 },
    );
  }
}
