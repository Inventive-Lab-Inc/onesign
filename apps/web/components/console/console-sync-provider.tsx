"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { pullConsoleData } from "@/lib/console-sync";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
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

  // persist APIs use localStorage — only available after client mount.
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    const persist = useConsoleDataStore.persist;
    if (!persist) {
      setCacheReady(true);
      return;
    }
    if (persist.hasHydrated()) {
      setCacheReady(true);
    }
    const unsub = persist.onFinishHydration(() => {
      setCacheReady(true);
    });
    return unsub;
  }, []);

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
