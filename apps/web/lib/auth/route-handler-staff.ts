import type { PlatformStaff, Profile } from "@signage/types";
import type { User } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { fetchProfileRow } from "@/lib/supabase/profile";

/** Auth + profile + optional staff row for Route Handlers. */
export async function getRouteHandlerStaffAuth(): Promise<{
  supabase: ReturnType<typeof getSupabaseServerClient>;
  user: User | null;
  profile: Profile | null;
  staff: PlatformStaff | null;
}> {
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { supabase, user: null, profile: null, staff: null };
  }

  const [{ profile }, { data: staff, error: staffError }] = await Promise.all([
    fetchProfileRow(supabase, user.id).then((row) => ({ profile: row })),
    supabase
      .from("platform_staff")
      .select("user_id, email, display_name, role, is_active, created_at")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (staffError) {
    console.warn("[getRouteHandlerStaffAuth] staff", staffError.message);
  }

  return {
    supabase,
    user,
    profile,
    staff: (staff as PlatformStaff | null) ?? null,
  };
}
