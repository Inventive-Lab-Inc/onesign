"use client";

import { useSyncExternalStore } from "react";
import { useConsoleDataStore } from "@/stores/console-data-store";

/** True after the persisted console cache has rehydrated from localStorage (client-only). */
export function useConsoleStoreHydrated(): boolean {
  const persist = useConsoleDataStore.persist;
  return useSyncExternalStore(
    persist ? persist.onFinishHydration : () => () => {},
    () => persist?.hasHydrated() ?? true,
    () => false,
  );
}
