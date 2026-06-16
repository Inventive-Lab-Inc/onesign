"use client";

import { useSyncExternalStore } from "react";
import { useConsoleDataStore } from "@/stores/console-data-store";

function subscribeHydration(onStoreChange: () => void) {
  const persist = useConsoleDataStore.persist;
  if (!persist) return () => {};
  if (persist.hasHydrated()) return () => {};
  return persist.onFinishHydration(onStoreChange);
}

function getHydrationSnapshot() {
  const persist = useConsoleDataStore.persist;
  return persist?.hasHydrated() ?? true;
}

/** True after the persisted console cache has rehydrated from localStorage (client-only). */
export function useConsoleStoreHydrated(): boolean {
  return useSyncExternalStore(subscribeHydration, getHydrationSnapshot, () => false);
}
