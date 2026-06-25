import "@/lib/supabase/tls-init";
import { createClient } from "@supabase/supabase-js";
import { getPasswordResetRedirectUrl } from "@/lib/auth/app-url";
import { getSupabaseConnectEnv } from "@/lib/supabase/env";

/**
 * Emails a freshly created client a secure link to set their own password.
 * Reuses Supabase's recovery email (the branded reset-password template), so we
 * never send a plaintext password. The anon client is used on purpose — the
 * recovery endpoint is public and must not run with the service-role bearer.
 */
export async function sendPasswordSetupEmail(email: string): Promise<void> {
  const connect = getSupabaseConnectEnv();
  if (!connect) {
    throw new Error("Missing Supabase configuration.");
  }

  const client = createClient(connect.url, connect.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: getPasswordResetRedirectUrl(),
  });

  if (error) {
    throw error;
  }
}
