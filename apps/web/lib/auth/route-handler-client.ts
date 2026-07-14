import type { NextRequest } from "next/server";
import type { PlatformStaff, Profile } from "@signage/types";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getRouteHandlerBearerAuth } from "@/lib/auth/route-handler-bearer";
import { getRouteHandlerStaffAuth } from "@/lib/auth/route-handler-staff";
import { fetchProfileRow } from "@/lib/supabase/profile";

/**
 * Cookie session (web) or `Authorization: Bearer` (mobile / TV clients).
 * Same profile + staff enrichment as [getRouteHandlerStaffAuth].
 */
export async function getRouteHandlerClientAuth(request: NextRequest): Promise<{
  supabase: SupabaseClient;
  user: User | null;
  profile: Profile | null;
  staff: PlatformStaff | null;
}> {
  const cookieAuth = await getRouteHandlerStaffAuth();
  if (cookieAuth.user) {
    return cookieAuth;
  }

  const bearer = await getRouteHandlerBearerAuth(request);
  if ("error" in bearer) {
    return { supabase: cookieAuth.supabase, user: null, profile: null, staff: null };
  }

  const [{ profile }, { data: staff, error: staffError }] = await Promise.all([
    fetchProfileRow(bearer.supabase, bearer.user.id).then((row) => ({ profile: row })),
    bearer.supabase
      .from("platform_staff")
      .select("user_id, email, display_name, role, is_active, created_at")
      .eq("user_id", bearer.user.id)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (staffError) {
    console.warn("[getRouteHandlerClientAuth] staff", staffError.message);
  }

  return {
    supabase: bearer.supabase,
    user: bearer.user,
    profile,
    staff: (staff as PlatformStaff | null) ?? null,
  };
}
