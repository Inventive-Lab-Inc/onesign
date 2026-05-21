"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { shellChrome } from "@/components/shell/shell-chrome";
import { useConsoleDataStore } from "@/stores/console-data-store";
import { useConsoleSync } from "./console-sync-provider";

function formatSynced(ts: number | null) {
  if (ts == null) return "—";
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function ConsoleSyncButton() {
  const { syncNow, lastSyncedAt, isSyncing, syncError, cacheReady } = useConsoleSync();

  const handleClick = useCallback(() => {
    void (async () => {
      await syncNow();
      const err = useConsoleDataStore.getState().syncError;
      if (err) toast.error(err);
      else toast.success("Synced with server");
    })();
  }, [syncNow]);

  const hoverTitle = useMemo(() => {
    if (syncError) {
      return `Sync failed: ${syncError}`;
    }
    return `Last updated ${formatSynced(lastSyncedAt)}. Click to pull from Supabase now. A background sync also runs on a timer.`;
  }, [lastSyncedAt, syncError]);

  const ariaLabel = useMemo(() => {
    if (syncError) return `Sync with server. Error: ${syncError}`;
    return `Sync with server. Last updated ${formatSynced(lastSyncedAt)}.`;
  }, [lastSyncedAt, syncError]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!cacheReady || isSyncing}
      title={hoverTitle}
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.375rem",
        height: "2rem",
        padding: "0 0.625rem",
        borderRadius: "0.4375rem",
        border: shellChrome.border,
        background: shellChrome.background,
        fontSize: "0.75rem",
        fontWeight: 600,
        color: shellChrome.text,
        cursor: !cacheReady || isSyncing ? "not-allowed" : "pointer",
        flexShrink: 0,
        opacity: !cacheReady || isSyncing ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (!cacheReady || isSyncing) return;
        e.currentTarget.style.background = shellChrome.backgroundHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = shellChrome.background;
      }}
    >
      <RefreshCw
        className={isSyncing ? "animate-spin" : undefined}
        size={14}
        color={shellChrome.icon}
        strokeWidth={2}
        aria-hidden
      />
      {isSyncing ? "Syncing…" : "Sync"}
    </button>
  );
}
