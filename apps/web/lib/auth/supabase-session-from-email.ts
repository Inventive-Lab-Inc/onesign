import "@/lib/supabase/tls-init";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseConnectEnv } from "@/lib/supabase/env";

type CookieStore = {
  getAll(): { name: string; value: string }[];
  setAll(cookies: { name: string; value: string; options: CookieOptions }[]): void;
};

export async function establishSupabaseSessionForEmail(
  email: string,
  cookieStore: CookieStore,
): Promise<void> {
  const connect = getSupabaseConnectEnv();
  if (!connect) {
    throw new Error("Missing Supabase configuration.");
  }

  const admin = getSupabaseAdminClient();
  const { data, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (linkError) {
    throw linkError;
  }

  const tokenHash = data.properties?.hashed_token;
  if (!tokenHash) {
    throw new Error("Supabase did not return a session token for Google bridge.");
  }

  const supabase = createServerClient(connect.url, connect.anonKey, {
    cookies: cookieStore,
  });

  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });

  if (verifyError) {
    throw verifyError;
  }
}

export async function establishSupabaseSessionOnResponse(
  request: NextRequest,
  response: NextResponse,
  email: string,
): Promise<void> {
  await establishSupabaseSessionForEmail(email, {
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });
    },
  });
}
