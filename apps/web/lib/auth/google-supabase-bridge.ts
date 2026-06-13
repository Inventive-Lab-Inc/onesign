import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { findAuthUserIdByEmail } from "@/lib/auth/find-user-by-email";

export interface GoogleBridgeInput {
  googleSub: string;
  email: string;
  name?: string;
  image?: string;
}

export class GoogleBridgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleBridgeError";
  }
}

async function linkGoogleIdentity(admin: SupabaseClient, googleSub: string, userId: string): Promise<void> {
  const { error } = await admin.from("auth_google_identities").upsert(
    { google_sub: googleSub, user_id: userId },
    { onConflict: "google_sub" },
  );

  if (error) {
    throw error;
  }
}

async function lookupLinkedUserId(admin: SupabaseClient, googleSub: string): Promise<string | null> {
  const { data, error } = await admin
    .from("auth_google_identities")
    .select("user_id")
    .eq("google_sub", googleSub)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.user_id ?? null;
}

export async function bridgeGoogleUserToSupabase(input: GoogleBridgeInput): Promise<string> {
  const admin = getSupabaseAdminClient();
  const email = input.email.trim();
  const googleSub = input.googleSub.trim();

  const linkedUserId = await lookupLinkedUserId(admin, googleSub);
  if (linkedUserId) {
    return linkedUserId;
  }

  const existingUserId = await findAuthUserIdByEmail(admin, email);
  if (existingUserId) {
    await linkGoogleIdentity(admin, googleSub, existingUserId);
    return existingUserId;
  }

  throw new GoogleBridgeError(
    "No account found for this Google email. Ask your administrator for an invitation.",
  );
}
