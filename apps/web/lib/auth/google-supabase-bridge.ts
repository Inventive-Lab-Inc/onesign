import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export interface GoogleBridgeInput {
  googleSub: string;
  email: string;
  name?: string;
  image?: string;
}

async function findUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const match = data.users.find((user) => user.email?.trim().toLowerCase() === normalizedEmail);
    if (match) {
      return match.id;
    }

    if (data.users.length < perPage) {
      break;
    }

    page += 1;
  }

  return null;
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

  const existingUserId = await findUserIdByEmail(admin, email);
  if (existingUserId) {
    await linkGoogleIdentity(admin, googleSub, existingUserId);
    return existingUserId;
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      full_name: input.name ?? null,
      avatar_url: input.image ?? null,
      google_sub: googleSub,
    },
    app_metadata: {
      providers: ["google"],
    },
  });

  if (createError) {
    throw createError;
  }

  const userId = created.user?.id;
  if (!userId) {
    throw new Error("Supabase did not return a user id after Google sign-up.");
  }

  await linkGoogleIdentity(admin, googleSub, userId);
  return userId;
}
