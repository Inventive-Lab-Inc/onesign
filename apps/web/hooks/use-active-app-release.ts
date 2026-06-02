"use client";

import type { AppRelease } from "@signage/types";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type ActiveAppRelease = Pick<AppRelease, "version_code" | "version_name">;

/** Active OTA rollout from `app_releases` (what TVs should install). */
export function useActiveAppRelease(): ActiveAppRelease | null {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [activeRelease, setActiveRelease] = useState<ActiveAppRelease | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("app_releases")
        .select("version_code, version_name")
        .eq("is_active", true)
        .maybeSingle();
      if (cancelled || error) return;
      if (data) {
        setActiveRelease(data as ActiveAppRelease);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return activeRelease;
}
