import "@/lib/supabase/tls-init";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConnectEnv } from "./env";

let adminClient: SupabaseClient | undefined;

export function getSupabaseAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const connect = getSupabaseConnectEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!connect || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase admin configuration. Set SUPABASE_SERVICE_ROLE_KEY (server-only) alongside your Supabase URL and anon key.",
    );
  }

  adminClient = createClient(connect.url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}
