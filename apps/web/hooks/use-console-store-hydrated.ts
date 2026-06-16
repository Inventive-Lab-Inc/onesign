"use client";

import { useEffect, useState } from "react";
import { useConsoleDataStore } from "@/stores/console-data-store";

/** True after the persisted console cache has rehydrated from localStorage (client-only). */
export function useConsoleStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persist = useConsoleDataStore.persist;
    if (!persist || persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return persist.onFinishHydration(() => {
      setHydrated(true);
    });
  }, []);

  return hydrated;
}
