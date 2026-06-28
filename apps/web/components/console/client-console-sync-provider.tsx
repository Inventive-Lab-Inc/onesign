"use client";

import { ConsoleSyncBridge } from "@/components/console/console-sync-bridge";
import { WorkspaceProvider } from "@/components/workspace/workspace-provider";
import type { AccountContext } from "@/lib/workspace/account-context";

/** Client console sync scoped to the billing account + active workspace. */
export function ClientConsoleSyncProvider({
  authUserId,
  initialAccountContext,
  children,
}: {
  authUserId: string;
  initialAccountContext?: AccountContext | null;
  children: React.ReactNode;
}) {
  return (
    <WorkspaceProvider authUserId={authUserId} initialContext={initialAccountContext}>
      <ConsoleSyncBridge>{children}</ConsoleSyncBridge>
    </WorkspaceProvider>
  );
}
