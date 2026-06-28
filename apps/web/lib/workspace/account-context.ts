import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkspacePermission, WorkspaceRole } from "@signage/types";
import { workspaceRoleHasPermission } from "@signage/types";

export type WorkspaceSummary = {
  id: string;
  account_id: string;
  name: string;
  is_default: boolean;
  role: WorkspaceRole;
  permissions: WorkspacePermission[];
};

export type AccountContext = {
  accountOwnerId: string;
  workspaces: WorkspaceSummary[];
  canAdminAccount: boolean;
  isAccountOwner: boolean;
};

type WorkspaceRow = {
  id: string;
  account_id: string;
  name: string;
  is_default: boolean;
  role: WorkspaceRole;
  permissions: WorkspacePermission[] | null;
};

/** Resolves the billing account owner id for the signed-in user. */
export async function fetchAccountOwnerId(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.rpc("primary_account_id");
  if (error) {
    console.warn("[account-context] primary_account_id failed:", error.message);
    return null;
  }
  return typeof data === "string" ? data : null;
}

/** Workspaces the signed-in user can access, with their role in each. */
export async function fetchMyWorkspaces(supabase: SupabaseClient): Promise<WorkspaceSummary[]> {
  const { data, error } = await supabase.rpc("list_my_workspaces");
  if (error) {
    console.warn("[account-context] list_my_workspaces failed:", error.message);
    return [];
  }
  return ((data as WorkspaceRow[] | null) ?? []).map((row) => ({
    id: row.id,
    account_id: row.account_id,
    name: row.name,
    is_default: row.is_default,
    role: row.role,
    permissions: row.permissions ?? [],
  }));
}

export async function fetchAccountContext(supabase: SupabaseClient, authUserId: string): Promise<AccountContext> {
  const [accountOwnerId, workspaces] = await Promise.all([
    fetchAccountOwnerId(supabase),
    fetchMyWorkspaces(supabase),
  ]);

  const ownerId = accountOwnerId ?? authUserId;
  const isAccountOwner = ownerId === authUserId;
  const canAdminAccount =
    isAccountOwner ||
    workspaces.some((workspace) =>
      workspaceRoleHasPermission(workspace.role, "administrator", workspace.permissions),
    );

  return {
    accountOwnerId: ownerId,
    workspaces,
    canAdminAccount,
    isAccountOwner,
  };
}

export function pickActiveWorkspaceId(
  workspaces: WorkspaceSummary[],
  preferredId: string | null | undefined,
): string | null {
  if (workspaces.length === 0) return null;
  if (preferredId && workspaces.some((w) => w.id === preferredId)) {
    return preferredId;
  }
  const defaultWs = workspaces.find((w) => w.is_default);
  return defaultWs?.id ?? workspaces[0]!.id;
}
