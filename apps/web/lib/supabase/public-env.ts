import { projectUrlFromAnonKey } from "./env";

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  for (const v of values) {
    if (v != null && v.trim() !== "") return v.trim();
  }
  return undefined;
}

declare global {
  interface Window {
    __SIGNAGE_SUPABASE__?: { url: string; anonKey: string };
  }
}

/**
 * Supabase URL + anon key for browser code.
 * URL is derived from the anon JWT `ref` when possible so stale env URLs cannot break login.
 */
export function getSupabasePublicEnv(): { url: string; anonKey: string } | null {
  const anonKey = firstNonEmpty(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    typeof window !== "undefined" ? window.__SIGNAGE_SUPABASE__?.anonKey : undefined,
  );
  if (!anonKey) return null;

  const url =
    projectUrlFromAnonKey(anonKey) ??
    firstNonEmpty(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      typeof window !== "undefined" ? window.__SIGNAGE_SUPABASE__?.url : undefined,
    );
  if (!url) return null;

  return { url, anonKey };
}
