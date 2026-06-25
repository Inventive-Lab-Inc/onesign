import { NextResponse, type NextRequest } from "next/server";
import { isStaffWriter } from "@/lib/auth/staff-utils";
import { getRouteHandlerStaffAuth } from "@/lib/auth/route-handler-staff";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { findAuthUserIdByEmail } from "@/lib/auth/find-user-by-email";
import { sendPasswordSetupEmail } from "@/lib/auth/send-password-setup-email";
import { DEFAULT_STORAGE_LIMIT_BYTES } from "@/lib/plan-quota";

export const runtime = "nodejs";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: NextRequest) {
  const { user, staff } = await getRouteHandlerStaffAuth();
  if (!user || !staff || !isStaffWriter(staff)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    email?: string;
    clientName?: string;
    password?: string;
    deviceLimit?: number;
    storageLimitBytes?: number;
    sendSetupEmail?: boolean;
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

  // Default to the secure path: email the client a set-password link instead of
  // an admin-chosen password. A password is only required for the manual path.
  const sendSetupEmail = body.sendSetupEmail !== false;
  const password = body.password ?? "";
  if (!sendSetupEmail && password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 },
    );
  }

  const clientName = body.clientName?.trim() || undefined;
  const deviceLimit =
    typeof body.deviceLimit === "number" && body.deviceLimit >= 1
      ? Math.floor(body.deviceLimit)
      : 1;
  const storageLimitBytes =
    typeof body.storageLimitBytes === "number" && body.storageLimitBytes > 0
      ? Math.floor(body.storageLimitBytes)
      : DEFAULT_STORAGE_LIMIT_BYTES;

  const admin = getSupabaseAdminClient();

  const existingId = await findAuthUserIdByEmail(admin, email);
  if (existingId) {
    return NextResponse.json(
      { error: "An account with this email already exists.", code: "already_exists" },
      { status: 409 },
    );
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: sendSetupEmail ? undefined : password,
    email_confirm: true,
    user_metadata: {
      full_name: clientName,
      skip_trial: "true",
    },
  });

  if (createError || !created.user?.id) {
    return NextResponse.json(
      { error: createError?.message ?? "Could not create account" },
      { status: 400 },
    );
  }

  const userId = created.user.id;
  const resolvedClientName = (clientName || email.split("@")[0] || email).trim();

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      client_name: resolvedClientName,
      device_limit: deviceLimit,
      storage_limit_bytes: storageLimitBytes,
    })
    .eq("id", userId);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  if (sendSetupEmail) {
    try {
      await sendPasswordSetupEmail(email);
    } catch {
      // The account exists and is usable; only the email failed. Surface a soft
      // warning so the admin can retry via "Forgot password" rather than failing.
      return NextResponse.json({
        ok: true,
        userId,
        emailSent: false,
        message: `Account created for ${email}, but the set-password email could not be sent. Ask them to use “Forgot password”, or retry later.`,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    userId,
    emailSent: sendSetupEmail,
    message: sendSetupEmail
      ? `Account created. A set-password email was sent to ${email}.`
      : `Account created for ${email}.`,
  });
}
