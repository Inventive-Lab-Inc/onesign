import { getInviteAcceptRedirectUrl } from "@/lib/auth/app-url";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { findAuthUserIdByEmail } from "@/lib/auth/find-user-by-email";
import { InviteUserError, inviteAuthUser } from "@/lib/auth/invite-user";

export type SendAccountInviteEmailResult =
  | { kind: "sent"; resent: boolean }
  | { kind: "already_active" }
  | { kind: "not_needed" };

/** Sends (or resends) the Supabase invite email for an account collaborator. */
export async function sendAccountMemberInviteEmail(input: {
  email: string;
  displayName?: string;
}): Promise<SendAccountInviteEmailResult> {
  const email = input.email.trim().toLowerCase();
  const admin = getSupabaseAdminClient();
  const existingId = await findAuthUserIdByEmail(admin, email);

  if (existingId) {
    const { data: existingData, error: existingError } = await admin.auth.admin.getUserById(existingId);
    if (existingError || !existingData.user) {
      throw new InviteUserError("invite_failed", existingError?.message ?? "Could not load user");
    }

    if (existingData.user.last_sign_in_at) {
      return { kind: "already_active" };
    }
  }

  try {
    const result = await inviteAuthUser({
      email,
      clientName: input.displayName,
      redirectTo: getInviteAcceptRedirectUrl(),
      accountMemberInvite: true,
    });
    return { kind: "sent", resent: result.resent };
  } catch (err) {
    if (err instanceof InviteUserError && err.code === "already_active") {
      return { kind: "already_active" };
    }
    throw err;
  }
}
