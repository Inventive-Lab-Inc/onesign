"use client";

import { ConsoleSyncBridge } from "@/components/console/console-sync-bridge";
import { WorkspaceProvider } from "@/components/workspace/workspace-provider";
import type { AccountContext } from "@/lib/workspace/account-context";

/** Client console sync scoped to the billing account + active workspace. */
export function ClientConsoleSyncProvider({
  authUserId,
  initialAccountContext,
  initialActiveWorkspaceId,
  children,
}: {
  authUserId: string;
  initialAccountContext?: AccountContext | null;
  initialActiveWorkspaceId?: string | null;
  children: React.ReactNode;
}) {
  return (
    <WorkspaceProvider
      authUserId={authUserId}
      initialContext={initialAccountContext}
      initialActiveWorkspaceId={initialActiveWorkspaceId}
    >
      <ConsoleSyncBridge>{children}</ConsoleSyncBridge>
    </WorkspaceProvider>
  );
}
