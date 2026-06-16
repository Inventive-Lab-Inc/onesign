"use client";

import { useEffect } from "react";
import {
  applyDevicePresenceRows,
  fetchDevicePresence,
  PRESENCE_POLL_INTERVAL_MS,
} from "@/lib/device-presence";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** Polls TV liveness fields — isolated so parent re-renders do not churn subscriptions. */
export function DevicePresenceSync({ userId }: { userId: string }) {
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let cancelled = false;

    const refreshPresence = async () => {
      if (cancelled) return;
      try {
        const rows = await fetchDevicePresence(supabase, userId);
        if (!cancelled) applyDevicePresenceRows(rows);
      } catch (err) {
        console.warn("[DevicePresenceSync] device presence refresh failed:", err);
      }
    };

    void refreshPresence();

    const pollId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refreshPresence();
    }, PRESENCE_POLL_INTERVAL_MS);

    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") {
        void refreshPresence();
      }
    };
    document.addEventListener("visibilitychange", refreshOnFocus);
    window.addEventListener("focus", refreshOnFocus);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      document.removeEventListener("visibilitychange", refreshOnFocus);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [userId]);

  return null;
}
