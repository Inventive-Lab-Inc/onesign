"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { PlanQuotaSnapshot } from "@/lib/plan-quota";
import { useConsoleDataStore } from "@/stores/console-data-store";

const PlanQuotaContext = createContext<PlanQuotaSnapshot | null>(null);

export function PlanQuotaProvider({
  quota,
  children,
}: {
  quota: PlanQuotaSnapshot;
  children: ReactNode;
}) {
  return <PlanQuotaContext.Provider value={quota}>{children}</PlanQuotaContext.Provider>;
}

/** Merges server plan snapshot with live console cache (device/media counts). */
export function usePlanQuota(): PlanQuotaSnapshot | null {
  const base = useContext(PlanQuotaContext);
  const deviceCount = useConsoleDataStore((s) => s.devices.length);
  const storageFromMedia = useConsoleDataStore((s) =>
    s.media.reduce((sum, row) => sum + (row.size_bytes ?? 0), 0),
  );

  return useMemo(() => {
    if (!base) return null;
    return {
      ...base,
      deviceCount: Math.max(base.deviceCount, deviceCount),
      storageUsedBytes: Math.max(base.storageUsedBytes, storageFromMedia),
    };
  }, [base, deviceCount, storageFromMedia]);
}

/** @deprecated Use usePlanQuota().deviceLimit */
export function useDeviceLimit(): number | null {
  const quota = usePlanQuota();
  return quota?.deviceLimit ?? null;
}
