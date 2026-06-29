"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { WorkspacePermission, WorkspaceRole } from "@signage/types";
import { workspaceRoleHasPermission } from "@signage/types";
import {
  fetchAccountContext,
  pickActiveWorkspaceId,
  type AccountContext,
  type WorkspaceSummary,
} from "@/lib/workspace/account-context";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace/constants";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { clearConsoleCachePersist } from "@/stores/console-data-store";

type WorkspaceContextValue = {
  accountOwnerId: string;
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string | null;
  activeWorkspace: WorkspaceSummary | null;
  setActiveWorkspaceId: (workspaceId: string) => void;
  canAdminAccount: boolean;
  isAccountOwner: boolean;
  hasPermission: (permission: WorkspacePermission) => boolean;
  refreshWorkspaces: () => Promise<void>;
  ready: boolean;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function readWorkspaceCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${ACTIVE_WORKSPACE_COOKIE}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function writeWorkspaceCookie(workspaceId: string) {
  document.cookie = `${ACTIVE_WORKSPACE_COOKIE}=${encodeURIComponent(workspaceId)}; path=/; max-age=31536000; SameSite=Lax`;
}

export function WorkspaceProvider({
  authUserId,
  initialContext,
  initialActiveWorkspaceId,
  children,
}: {
  authUserId: string;
  initialContext?: AccountContext | null;
  initialActiveWorkspaceId?: string | null;
  children: ReactNode;
}) {
  const [context, setContext] = useState<AccountContext | null>(initialContext ?? null);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(
    () =>
      initialActiveWorkspaceId ??
      pickActiveWorkspaceId(initialContext?.workspaces ?? [], null),
  );
  const [ready, setReady] = useState(!!initialContext);

  const refreshWorkspaces = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const next = await fetchAccountContext(supabase, authUserId);
    setContext(next);
    setActiveWorkspaceIdState((current) => pickActiveWorkspaceId(next.workspaces, current ?? readWorkspaceCookie()));
    setReady(true);
  }, [authUserId]);

  useEffect(() => {
    if (!initialContext) {
      void refreshWorkspaces();
    }
  }, [initialContext, refreshWorkspaces]);

  const setActiveWorkspaceId = useCallback((workspaceId: string) => {
    setActiveWorkspaceIdState(workspaceId);
    writeWorkspaceCookie(workspaceId);
    clearConsoleCachePersist();
  }, []);

  const activeWorkspace = useMemo(
    () => context?.workspaces.find((w) => w.id === activeWorkspaceId) ?? null,
    [context?.workspaces, activeWorkspaceId],
  );

  const hasPermission = useCallback(
    (permission: WorkspacePermission) => {
      if (!activeWorkspace) return false;
      return workspaceRoleHasPermission(activeWorkspace.role, permission, activeWorkspace.permissions);
    },
    [activeWorkspace],
  );

  const value = useMemo<WorkspaceContextValue>(() => {
    const accountOwnerId = context?.accountOwnerId ?? authUserId;
    return {
      accountOwnerId,
      workspaces: context?.workspaces ?? [],
      activeWorkspaceId,
      activeWorkspace,
      setActiveWorkspaceId,
      canAdminAccount: context?.canAdminAccount ?? false,
      isAccountOwner: context?.isAccountOwner ?? true,
      hasPermission,
      refreshWorkspaces,
      ready,
    };
  }, [
    activeWorkspace,
    activeWorkspaceId,
    authUserId,
    context,
    hasPermission,
    ready,
    refreshWorkspaces,
    setActiveWorkspaceId,
  ]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return ctx;
}

export function useWorkspaceOptional() {
  return useContext(WorkspaceContext);
}

export function useActiveWorkspaceRole(): WorkspaceRole | null {
  return useWorkspace().activeWorkspace?.role ?? null;
}
