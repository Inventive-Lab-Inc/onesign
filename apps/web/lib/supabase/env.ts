function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  for (const v of values) {
    if (v != null && v.trim() !== "") return v.trim();
  }
  return undefined;
}

/** Derive project URL from the anon JWT `ref` claim (avoids stale SUPABASE_URL on Vercel). */
export function projectUrlFromAnonKey(anonKey: string): string | undefined {
  try {
    const segment = anonKey.split(".")[1];
    if (!segment) return undefined;
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof Buffer !== "undefined"
        ? Buffer.from(base64, "base64").toString("utf8")
        : typeof atob === "function"
          ? atob(base64)
          : "";
    const payload = JSON.parse(json) as { ref?: string };
    if (typeof payload.ref === "string" && payload.ref.length > 0) {
      return `https://${payload.ref}.supabase.co`;
    }
  } catch {
    // ignore malformed JWT segments
  }
  return undefined;
}

/**
 * URL + anon key for Supabase in Node, Route Handlers, and Middleware.
 *
 * Prefer `SUPABASE_*` (set in Vercel, read at runtime) so a deploy is not stuck with
 * empty inlined `NEXT_PUBLIC_*` from a build that ran before env was added.
 * URL is taken from the anon key JWT `ref` when present so a mismatched legacy URL env cannot break auth.
 */
export function getSupabaseConnectEnv(): { url: string; anonKey: string } | null {
  const anonKey = firstNonEmpty(
    process.env.SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  if (!anonKey) return null;

  const url =
    projectUrlFromAnonKey(anonKey) ??
    firstNonEmpty(process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!url) return null;

  return { url, anonKey };
}
