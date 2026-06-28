"use client";

import type { ReactNode } from "react";
import { ConsoleSyncProvider } from "@/components/console/console-sync-provider";
import { useWorkspace } from "@/components/workspace/workspace-provider";

export function ConsoleSyncBridge({ children }: { children: ReactNode }) {
  const { accountOwnerId, activeWorkspaceId, ready } = useWorkspace();

  if (!ready) {
    return children;
  }

  return (
    <ConsoleSyncProvider
      key={`${accountOwnerId}:${activeWorkspaceId ?? "none"}`}
      accountOwnerId={accountOwnerId}
      workspaceId={activeWorkspaceId}
    >
      {children}
    </ConsoleSyncProvider>
  );
}
