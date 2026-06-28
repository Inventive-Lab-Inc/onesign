import type { User } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Auth + account-admin check for account-scoped Route Handlers. */
export async function getRouteHandlerAccountAdminAuth(): Promise<{
  supabase: ReturnType<typeof getSupabaseServerClient>;
  user: User | null;
  accountOwnerId: string | null;
  canAdminAccount: boolean;
}> {
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { supabase, user: null, accountOwnerId: null, canAdminAccount: false };
  }

  const { data: accountOwnerId, error: accountError } = await supabase.rpc("primary_account_id");
  if (accountError || typeof accountOwnerId !== "string") {
    return { supabase, user, accountOwnerId: null, canAdminAccount: false };
  }

  const { data: canAdmin, error: adminError } = await supabase.rpc("can_admin_account", {
    p_account_id: accountOwnerId,
  });

  if (adminError) {
    console.warn("[getRouteHandlerAccountAdminAuth] can_admin_account", adminError.message);
  }

  return {
    supabase,
    user,
    accountOwnerId,
    canAdminAccount: canAdmin === true,
  };
}
