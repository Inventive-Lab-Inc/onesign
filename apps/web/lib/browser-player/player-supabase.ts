"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/supabase/public-env";

const PLAYER_AUTH_STORAGE_KEY = "onesign-player-auth";

let playerClient: SupabaseClient | undefined;

export function getPlayerSupabaseClient(): SupabaseClient {
  if (playerClient) return playerClient;

  const connect = getSupabasePublicEnv();
  if (!connect) {
    throw new Error(
      "Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  playerClient = createClient(connect.url, connect.anonKey, {
    auth: {
      storageKey: PLAYER_AUTH_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });

  return playerClient;
}

export async function ensureAnonymousPlayerSession(): Promise<string> {
  const supabase = getPlayerSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user?.id) {
    return sessionData.session.user.id;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user?.id) {
    throw error ?? new Error("Anonymous sign-in failed");
  }
  return data.user.id;
}

export async function getPlayerAccessToken(): Promise<string | null> {
  const supabase = getPlayerSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
