"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { pullConsoleData } from "@/lib/console-sync";
import { DevicePresenceSync } from "@/components/console/device-presence-sync";
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

function readSyncMeta() {
  const state = useConsoleDataStore.getState();
  return {
    lastSyncedAt: state.lastSyncedAt,
    isSyncing: state.isSyncing,
    syncError: state.syncError,
  };
}

export function ConsoleSyncProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [syncMeta, setSyncMeta] = useState(readSyncMeta);
  const cacheReady = useConsoleStoreHydrated();

  /** Coalesce overlapping syncs; re-pull once if a sync was requested mid-flight. */
  const syncInFlightRef = useRef<Promise<void> | null>(null);
  const syncAgainRef = useRef(false);
  const ownerInitRef = useRef<string | null>(null);

  useEffect(() => {
    return useConsoleDataStore.subscribe((state, prev) => {
      if (
        state.lastSyncedAt === prev.lastSyncedAt &&
        state.isSyncing === prev.isSyncing &&
        state.syncError === prev.syncError
      ) {
        return;
      }
      setSyncMeta({
        lastSyncedAt: state.lastSyncedAt,
        isSyncing: state.isSyncing,
        syncError: state.syncError,
      });
    });
  }, []);

  const syncNow = useCallback(async () => {
    if (syncInFlightRef.current) {
      syncAgainRef.current = true;
      return syncInFlightRef.current;
    }
    const { applySnapshot, setSyncError, setSyncing } = useConsoleDataStore.getState();
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
  }, [userId]);

  const syncNowRef = useRef(syncNow);
  syncNowRef.current = syncNow;

  useEffect(() => {
    if (!cacheReady) return;
    if (ownerInitRef.current === userId) return;
    ownerInitRef.current = userId;

    const { setOwnerId: assignOwnerId } = useConsoleDataStore.getState();
    const state = useConsoleDataStore.getState();
    if (state.ownerId !== null && state.ownerId !== userId) {
      clearConsoleCachePersist();
    }

    assignOwnerId(userId);

    const after = useConsoleDataStore.getState();
    if (after.lastSyncedAt === null) {
      void syncNowRef.current();
    }
  }, [cacheReady, userId]);

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
      lastSyncedAt: syncMeta.lastSyncedAt,
      isSyncing: syncMeta.isSyncing,
      syncError: syncMeta.syncError,
      cacheReady,
    }),
    [syncNow, syncMeta.lastSyncedAt, syncMeta.isSyncing, syncMeta.syncError, cacheReady],
  );

  return (
    <ConsoleOwnerContext.Provider value={userId}>
      <ConsoleSyncContext.Provider value={value}>
        {cacheReady ? <DevicePresenceSync userId={userId} /> : null}
        {children}
      </ConsoleSyncContext.Provider>
    </ConsoleOwnerContext.Provider>
  );
}
