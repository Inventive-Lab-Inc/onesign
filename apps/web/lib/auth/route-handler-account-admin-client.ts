import type { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRouteHandlerBearerAuth } from "@/lib/auth/route-handler-bearer";
import { getRouteHandlerAccountAdminAuth } from "@/lib/auth/route-handler-account-admin";
import { getSupabaseConnectEnv } from "@/lib/supabase/env";

/**
 * Cookie session (web) or Bearer (mobile) with account-admin RPC checks.
 */
export async function getRouteHandlerAccountAdminClientAuth(request: NextRequest): Promise<{
  supabase: SupabaseClient;
  user: User | null;
  accountOwnerId: string | null;
  canAdminAccount: boolean;
}> {
  const cookieAuth = await getRouteHandlerAccountAdminAuth();
  if (cookieAuth.user) {
    return cookieAuth;
  }

  const bearer = await getRouteHandlerBearerAuth(request);
  if ("error" in bearer) {
    return {
      supabase: cookieAuth.supabase,
      user: null,
      accountOwnerId: null,
      canAdminAccount: false,
    };
  }

  const { data: accountOwnerId, error: accountError } = await bearer.supabase.rpc(
    "primary_account_id",
  );
  if (accountError || typeof accountOwnerId !== "string") {
    return {
      supabase: bearer.supabase,
      user: bearer.user,
      accountOwnerId: null,
      canAdminAccount: false,
    };
  }

  const { data: canAdmin, error: adminError } = await bearer.supabase.rpc("can_admin_account", {
    p_account_id: accountOwnerId,
  });
  if (adminError) {
    console.warn("[getRouteHandlerAccountAdminClientAuth] can_admin_account", adminError.message);
  }

  return {
    supabase: bearer.supabase,
    user: bearer.user,
    accountOwnerId,
    canAdminAccount: canAdmin === true,
  };
}

/** Issue access/refresh tokens for a user email (same bridge path as Google web). */
export async function issueSupabaseSessionTokensForEmail(email: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}> {
  const connect = getSupabaseConnectEnv();
  if (!connect) {
    throw new Error("Missing Supabase configuration.");
  }

  const { getSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const admin = getSupabaseAdminClient();
  const { data, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError) throw linkError;

  const tokenHash = data.properties?.hashed_token;
  if (!tokenHash) {
    throw new Error("Supabase did not return a session token.");
  }

  const supabase = createClient(connect.url, connect.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (verifyError || !verified.session) {
    throw verifyError ?? new Error("Could not establish session.");
  }

  return {
    access_token: verified.session.access_token,
    refresh_token: verified.session.refresh_token,
    expires_in: verified.session.expires_in ?? 3600,
    token_type: verified.session.token_type ?? "bearer",
  };
}
