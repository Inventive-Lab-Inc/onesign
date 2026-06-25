import { NextResponse, type NextRequest } from "next/server";
import { getInviteAcceptRedirectUrl } from "@/lib/auth/app-url";
import { InviteUserError, inviteAuthUser } from "@/lib/auth/invite-user";
import { isStaffWriter } from "@/lib/auth/staff-utils";
import { getRouteHandlerStaffAuth } from "@/lib/auth/route-handler-staff";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_STORAGE_LIMIT_BYTES } from "@/lib/plan-quota";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { user, staff, supabase } = await getRouteHandlerStaffAuth();
  if (!user || !staff || !isStaffWriter(staff)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    email?: string;
    clientName?: string;
    deviceLimit?: number;
    storageLimitBytes?: number;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const hasDeviceLimit = typeof body.deviceLimit === "number" && body.deviceLimit >= 1;
  const hasStorageLimit =
    typeof body.storageLimitBytes === "number" && body.storageLimitBytes > 0;
  const deviceLimit = hasDeviceLimit ? Math.floor(body.deviceLimit!) : undefined;
  const storageLimitBytes = hasStorageLimit
    ? Math.floor(body.storageLimitBytes!)
    : undefined;

  try {
    const { userId, resent } = await inviteAuthUser({
      email,
      clientName: body.clientName?.trim(),
      redirectTo: getInviteAcceptRedirectUrl(),
    });

    const admin = getSupabaseAdminClient();
    const resolvedClientName = (body.clientName?.trim() || email.split("@")[0] || email).trim();

    const profilePatch: Record<string, string | number> = {};
    if (body.clientName?.trim()) {
      profilePatch.client_name = resolvedClientName;
    } else if (!resent) {
      profilePatch.client_name = resolvedClientName;
    }
    if (deviceLimit !== undefined) {
      profilePatch.device_limit = deviceLimit;
    } else if (!resent) {
      profilePatch.device_limit = 1;
    }
    if (storageLimitBytes !== undefined) {
      profilePatch.storage_limit_bytes = storageLimitBytes;
    } else if (!resent) {
      profilePatch.storage_limit_bytes = DEFAULT_STORAGE_LIMIT_BYTES;
    }

    if (Object.keys(profilePatch).length > 0) {
      const { error: profileError } = await admin
        .from("profiles")
        .update(profilePatch)
        .eq("id", userId);

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 400 });
      }
    }

    const { error: inviteRecordError } = await supabase.rpc("admin_record_client_invitation", {
      p_email: email,
      p_user_id: userId,
      p_client_name: resolvedClientName,
    });

    if (inviteRecordError) {
      return NextResponse.json({ error: inviteRecordError.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      userId,
      resent,
      message: resent
        ? `Invitation resent to ${email}.`
        : `Invitation sent to ${email}.`,
    });
  } catch (err) {
    if (err instanceof InviteUserError) {
      const status = err.code === "already_active" ? 409 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }

    const message = err instanceof Error ? err.message : "Invitation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
