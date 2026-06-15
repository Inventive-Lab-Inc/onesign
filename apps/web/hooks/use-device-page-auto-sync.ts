"use client";

import { useEffect, useRef } from "react";
import { useConsoleOwnerId, useConsoleSync } from "@/components/console/console-sync-provider";
import { applyDevicePresenceRows, fetchDevicePresence } from "@/lib/device-presence";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** Full console sync + liveness poll cadence while viewing device list or screen detail. */
export const DEVICE_PAGE_SYNC_INTERVAL_MS = 10_000;

/**
 * Runs full sync and a lightweight presence pull on mount and every [intervalMs] while mounted
 * (device routes only). Skips ticks while the tab is hidden; refreshes when visible again.
 */
export function useDevicePageAutoSync(intervalMs = DEVICE_PAGE_SYNC_INTERVAL_MS) {
  const { syncNow, cacheReady } = useConsoleSync();
  const ownerId = useConsoleOwnerId();
  const syncNowRef = useRef(syncNow);
  syncNowRef.current = syncNow;

  useEffect(() => {
    if (!cacheReady || !ownerId) return;

    const supabase = getSupabaseBrowserClient();
    let cancelled = false;

    const refreshLiveness = async () => {
      try {
        const rows = await fetchDevicePresence(supabase, ownerId);
        if (!cancelled) {
          applyDevicePresenceRows(rows);
        }
      } catch (err) {
        console.warn("[useDevicePageAutoSync] device presence refresh failed:", err);
      }
    };

    const refreshAll = () => {
      void syncNowRef.current();
      void refreshLiveness();
    };

    refreshAll();

    const pollId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      refreshAll();
    }, intervalMs);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshAll();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [cacheReady, ownerId, intervalMs]);
}
