import { NextResponse, type NextRequest } from "next/server";
import { parseUserId } from "@/lib/auth/resolve-data-owner";
import { getRouteHandlerStaffAuth } from "@/lib/auth/route-handler-staff";
import { isStaffWriter } from "@/lib/auth/staff-utils";
import {
  type ClientProvisioningInput,
  provisioningSummary,
  resolveClientProvisioning,
} from "@/lib/admin/client-provisioning";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PlanTemplate } from "@signage/types";

export const runtime = "nodejs";

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
    userId?: string;
    provisioning?: ClientProvisioningInput;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userId = parseUserId(body.userId);
  if (!userId) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  if (!body.provisioning?.mode) {
    return NextResponse.json({ error: "provisioning.mode is required" }, { status: 400 });
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

  const provisioning = resolveClientProvisioning(plans, body.provisioning);
  if ("error" in provisioning) {
    return NextResponse.json({ error: provisioning.error }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      device_limit: provisioning.deviceLimit,
      storage_limit_bytes: provisioning.storageLimitBytes,
      trial_ends_at: provisioning.trialEndsAt,
      plan_kind: provisioning.planKind,
      plan_template_id: provisioning.planTemplateId,
    })
    .eq("id", userId);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const { error: quotaError } = await admin.rpc("apply_device_quota", {
    p_user_id: userId,
    p_limit: provisioning.deviceLimit,
    p_active_device_ids: null,
    p_preserve_manual_disables: false,
  });

  if (quotaError) {
    return NextResponse.json({ error: quotaError.message }, { status: 500 });
  }

  const { error: syncError } = await admin.rpc("sync_user_app_metadata", { p_user_id: userId });
  if (syncError) {
    return NextResponse.json({ error: syncError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    provisioning,
    message: `Plan updated to ${provisioningSummary(provisioning)}.`,
  });
}
