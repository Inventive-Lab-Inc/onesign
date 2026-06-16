"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { pullConsoleData } from "@/lib/console-sync";
import {
  applyDevicePresenceRows,
  fetchDevicePresence,
  patchDevicePresenceFromRow,
  PRESENCE_POLL_INTERVAL_MS,
  type DevicePresenceRow,
} from "@/lib/device-presence";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useConsoleStoreHydrated } from "@/hooks/use-console-store-hydrated";
import { clearConsoleCachePersist, useConsoleDataStore } from "@/stores/console-data-store";

const DEFAULT_INTERVAL_MS = 120_000;

type ConsoleSyncContextValue = {
  syncNow: () => Promise<void>;
  lastSyncedAt: number | null;
  isSyncing: boolean;
  syncError: string | null;
  cacheReady: boolean;
};

const ConsoleSyncContext = createContext<ConsoleSyncContextValue | null>(null);
const ConsoleOwnerContext = createContext<string | null>(null);

export function useConsoleSync() {
  const ctx = useContext(ConsoleSyncContext);
  if (!ctx) {
    throw new Error("useConsoleSync must be used within ConsoleSyncProvider");
  }
  return ctx;
}

/** Tenant owner id — available immediately from auth/sync provider, before cache hydration. */
export function useConsoleOwnerId(): string | null {
  const tenantId = useContext(ConsoleOwnerContext);
  const storeOwnerId = useConsoleDataStore((s) => s.ownerId);
  return storeOwnerId ?? tenantId;
}

function readIntervalMs(): number {
  const raw = process.env.NEXT_PUBLIC_CONSOLE_SYNC_INTERVAL_MS;
  if (!raw) return DEFAULT_INTERVAL_MS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 15_000 ? n : DEFAULT_INTERVAL_MS;
}

export function ConsoleSyncProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const lastSyncedAt = useConsoleDataStore((s) => s.lastSyncedAt);
  const isSyncing = useConsoleDataStore((s) => s.isSyncing);
  const syncError = useConsoleDataStore((s) => s.syncError);
  const applySnapshot = useConsoleDataStore((s) => s.applySnapshot);
  const setOwnerId = useConsoleDataStore((s) => s.setOwnerId);
  const setSyncing = useConsoleDataStore((s) => s.setSyncing);
  const setSyncError = useConsoleDataStore((s) => s.setSyncError);

  /** Coalesce overlapping syncs; re-pull once if a sync was requested mid-flight. */
  const syncInFlightRef = useRef<Promise<void> | null>(null);
  const syncAgainRef = useRef(false);

  const cacheReady = useConsoleStoreHydrated();

  const syncNow = useCallback(async () => {
    if (syncInFlightRef.current) {
      syncAgainRef.current = true;
      return syncInFlightRef.current;
    }
    const run = async () => {
      setSyncing(true);
      setSyncError(null);
      try {
        do {
          syncAgainRef.current = false;
          const supabase = getSupabaseBrowserClient();
          const snapshot = await pullConsoleData(supabase, userId);
          applySnapshot(userId, snapshot, Date.now());
        } while (syncAgainRef.current);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Sync failed";
        setSyncError(message);
      } finally {
        setSyncing(false);
        syncInFlightRef.current = null;
      }
    };
    const p = run();
    syncInFlightRef.current = p;
    return p;
  }, [applySnapshot, setSyncError, setSyncing, userId]);

  const syncNowRef = useRef(syncNow);
  syncNowRef.current = syncNow;

  useEffect(() => {
    if (!cacheReady) return;

    const state = useConsoleDataStore.getState();
    if (state.ownerId !== null && state.ownerId !== userId) {
      clearConsoleCachePersist();
    }

    setOwnerId(userId);

    const after = useConsoleDataStore.getState();
    if (after.lastSyncedAt === null) {
      void syncNowRef.current();
    }
  }, [cacheReady, userId, setOwnerId]);

  useEffect(() => {
    if (!cacheReady) return;
    const ms = readIntervalMs();
    const id = window.setInterval(() => {
      void syncNowRef.current();
    }, ms);
    return () => window.clearInterval(id);
  }, [cacheReady, userId]);

  /**
   * TV heartbeats update `last_seen` / `status` in Postgres every ~30s, but full sync runs
   * much less often. Poll + Realtime keep the console cache aligned so badges do not flip
   * offline while a screen is still playing.
   */
  useEffect(() => {
    if (!cacheReady || !userId) return;

    const supabase = getSupabaseBrowserClient();
    let cancelled = false;

    const refreshPresence = async () => {
      try {
        const rows = await fetchDevicePresence(supabase, userId);
        if (!cancelled) applyDevicePresenceRows(rows);
      } catch (err) {
        console.warn("[ConsoleSyncProvider] device presence refresh failed:", err);
      }
    };

    void refreshPresence();

    const pollId = window.setInterval(() => {
      void refreshPresence();
    }, PRESENCE_POLL_INTERVAL_MS);

    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") {
        void refreshPresence();
      }
    };
    document.addEventListener("visibilitychange", refreshOnFocus);
    window.addEventListener("focus", refreshOnFocus);

    const channel = supabase
      .channel(`device-presence:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "devices",
          filter: `owner_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { id?: string; status?: string; last_seen?: string | null };
          if (!row.id || !row.status) return;
          patchDevicePresenceFromRow({
            id: row.id,
            status: row.status as DevicePresenceRow["status"],
            last_seen: row.last_seen ?? null,
          });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void refreshPresence();
        }
      });

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      document.removeEventListener("visibilitychange", refreshOnFocus);
      window.removeEventListener("focus", refreshOnFocus);
      void supabase.removeChannel(channel);
    };
  }, [cacheReady, userId]);

  const value = useMemo<ConsoleSyncContextValue>(
    () => ({
      syncNow,
      lastSyncedAt,
      isSyncing,
      syncError,
      cacheReady,
    }),
    [syncNow, lastSyncedAt, isSyncing, syncError, cacheReady],
  );

  return (
    <ConsoleOwnerContext.Provider value={userId}>
      <ConsoleSyncContext.Provider value={value}>{children}</ConsoleSyncContext.Provider>
    </ConsoleOwnerContext.Provider>
  );
}
