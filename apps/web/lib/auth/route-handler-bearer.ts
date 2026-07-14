import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { getSupabaseConnectEnv } from "@/lib/supabase/env";

/** Supabase user from `Authorization: Bearer <access_token>` (TV / API clients). */
export async function getRouteHandlerBearerAuth(
  request: NextRequest,
): Promise<{ supabase: SupabaseClient; user: User } | { error: string; status: number }> {
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) {
    return { error: "Unauthorized", status: 401 };
  }

  const connect = getSupabaseConnectEnv();
  if (!connect) {
    return { error: "Server misconfigured", status: 503 };
  }

  const supabase = createClient(connect.url, connect.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  // Pass the JWT explicitly — more reliable than relying on global headers alone.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { error: "Unauthorized", status: 401 };
  }

  return { supabase, user };
}
