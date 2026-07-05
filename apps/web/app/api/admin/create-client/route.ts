import { NextResponse, type NextRequest } from "next/server";
import { isStaffWriter } from "@/lib/auth/staff-utils";
import { getRouteHandlerStaffAuth } from "@/lib/auth/route-handler-staff";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { findAuthUserIdByEmail } from "@/lib/auth/find-user-by-email";
import { sendPasswordSetupEmail } from "@/lib/auth/send-password-setup-email";
import {
  type ClientProvisioningInput,
  provisioningSummary,
  resolveClientProvisioning,
} from "@/lib/admin/client-provisioning";
import type { PlanTemplate } from "@signage/types";

export const runtime = "nodejs";

const MIN_PASSWORD_LENGTH = 8;

async function loadActivePlanCatalog(): Promise<PlanTemplate[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("list_active_plans");
  if (error) {
    throw new Error(error.message);
  }
  return (data as PlanTemplate[]) ?? [];
}

export async function POST(request: NextRequest) {
  const { user, staff } = await getRouteHandlerStaffAuth();
  if (!user || !staff || !isStaffWriter(staff)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    email?: string;
    clientName?: string;
    password?: string;
    sendSetupEmail?: boolean;
    provisioning?: ClientProvisioningInput;
    /** @deprecated Legacy clients — use provisioning instead. */
    deviceLimit?: number;
    storageLimitBytes?: number;
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

  const sendSetupEmail = body.sendSetupEmail !== false;
  const password = body.password ?? "";
  if (!sendSetupEmail && password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 },
    );
  }

  let provisioningInput = body.provisioning;
  if (!provisioningInput) {
    provisioningInput = {
      mode: "custom",
      deviceLimit:
        typeof body.deviceLimit === "number" && body.deviceLimit >= 1
          ? Math.floor(body.deviceLimit)
          : 1,
      storageLimitBytes:
        typeof body.storageLimitBytes === "number" && body.storageLimitBytes > 0
          ? Math.floor(body.storageLimitBytes)
          : undefined,
    };
  }

  let plans: PlanTemplate[];
  try {
    plans = await loadActivePlanCatalog();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load plan catalog" },
      { status: 500 },
    );
  }

  const provisioning = resolveClientProvisioning(plans, provisioningInput);
  if ("error" in provisioning) {
    return NextResponse.json({ error: provisioning.error }, { status: 400 });
  }

  const clientName = body.clientName?.trim() || undefined;
  const admin = getSupabaseAdminClient();

  const existingId = await findAuthUserIdByEmail(admin, email);
  if (existingId) {
    return NextResponse.json(
      { error: "An account with this email already exists.", code: "already_exists" },
      { status: 409 },
    );
  }

  const userMetadata: Record<string, string | undefined> = {
    full_name: clientName,
  };
  if (provisioning.skipTrial) {
    userMetadata.skip_trial = "true";
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: sendSetupEmail ? undefined : password,
    email_confirm: true,
    user_metadata: userMetadata,
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
      device_limit: provisioning.deviceLimit,
      storage_limit_bytes: provisioning.storageLimitBytes,
      trial_ends_at: provisioning.trialEndsAt,
      plan_kind: provisioning.planKind,
    })
    .eq("id", userId);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const { error: syncError } = await admin.rpc("sync_user_app_metadata", { p_user_id: userId });
  if (syncError) {
    return NextResponse.json({ error: syncError.message }, { status: 500 });
  }

  const planLabel = provisioningSummary(provisioning);

  if (sendSetupEmail) {
    try {
      await sendPasswordSetupEmail(email);
    } catch {
      return NextResponse.json({
        ok: true,
        userId,
        emailSent: false,
        provisioning,
        message: `Account created for ${email} on ${planLabel}, but the set-password email could not be sent. Ask them to use “Forgot password”, or retry later.`,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    userId,
    emailSent: sendSetupEmail,
    provisioning,
    message: sendSetupEmail
      ? `Account created on ${planLabel}. A set-password email was sent to ${email}.`
      : `Account created for ${email} on ${planLabel}.`,
  });
}
