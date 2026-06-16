"use client";

import type { ReactNode } from "react";
import { useConsoleStoreHydrated } from "@/hooks/use-console-store-hydrated";

function DefaultFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading console data">
      <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
      <div className="h-48 animate-pulse rounded-xl bg-muted/60" />
    </div>
  );
}

/** Avoid SSR/client mismatch from zustand persist rehydrating before React hydration finishes. */
export function ConsoleStoreGate({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const hydrated = useConsoleStoreHydrated();
  if (!hydrated) return fallback ?? <DefaultFallback />;
  return children;
}
