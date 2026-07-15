"use client";

import type { AccountUser } from "@signage/types";
import { displayWorkspaceName } from "@signage/types";
import { ChevronDown, Search, Settings2, Users } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AccessCell,
  EditUserPermissionsDialog,
  InviteUserDialog,
  RemoveUserButton,
  ResendInviteButton,
  persistWorkspaceAccess,
  roleLabel,
  type WorkspaceRoleOrNone,
} from "@/components/account/account-user-access";
import { useAdminStaff } from "@/components/admin/admin-staff-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { friendlyWorkspaceError } from "@/lib/workspace/error-messages";

type WorkspaceRow = { id: string; name: string };

export function AdminClientUsersPanel({ accountId }: { accountId: string }) {
  const { canWrite } = useAdminStaff();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [users, setUsers] = useState<AccountUser[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [editingUser, setEditingUser] = useState<AccountUser | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const workspaceNameById = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace.name])),
    [workspaces],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const [usersResult, workspacesResult] = await Promise.all([
      supabase.rpc("admin_list_account_users", { p_account_id: accountId }),
      supabase.from("workspaces").select("id, name").eq("account_id", accountId).order("name"),
    ]);

    if (usersResult.error) {
      toast.error(friendlyWorkspaceError(usersResult.error.message));
      setLoading(false);
      return;
    }
    if (workspacesResult.error) {
      toast.error(workspacesResult.error.message);
      setLoading(false);
      return;
    }

    setUsers((usersResult.data as AccountUser[]) ?? []);
    setWorkspaces(
      ((workspacesResult.data as WorkspaceRow[]) ?? []).map((workspace) => ({
        ...workspace,
        name: displayWorkspaceName(workspace.name),
      })),
    );
    setLoading(false);
  }, [accountId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeAccess = useCallback(
    async (user: AccountUser, workspaceId: string, role: WorkspaceRoleOrNone) => {
      if (role === "custom") {
        setEditingUser(user);
        return;
      }
      try {
        await persistWorkspaceAccess({
          accountOwnerId: accountId,
          user,
          workspaceId,
          role,
          asStaff: true,
        });
        toast.success("Access updated");
        await load();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update access");
      }
    },
    [accountId, load],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
            <h2 className="text-sm font-semibold text-foreground">Users</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Invite teammates for this client and set their workspace access.
          </p>
        </div>
        {canWrite ? (
          <Button type="button" size="sm" onClick={() => setShowInvite(true)} disabled={workspaces.length === 0}>
            Add user
          </Button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading users…</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted-foreground">No users yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-4 py-3 font-semibold text-foreground">User</th>
                <th className="px-4 py-3 font-semibold text-foreground">Workspace access</th>
                <th className="px-4 py-3 text-right font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => {
                const rowKey = user.user_id ?? user.email;
                const expanded = expandedKey === rowKey;
                return (
                  <Fragment key={rowKey}>
                    <tr className="align-middle">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {!user.is_owner && canWrite ? (
                            <button
                              type="button"
                              onClick={() => setExpandedKey(expanded ? null : rowKey)}
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              aria-label={expanded ? "Collapse workspace access" : "Expand workspace access"}
                              aria-expanded={expanded}
                            >
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : "-rotate-90"}`}
                                aria-hidden
                              />
                            </button>
                          ) : (
                            <span className="h-6 w-6 shrink-0" aria-hidden />
                          )}
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white"
                            aria-hidden
                          >
                            {(user.display_name ?? user.email).slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {user.display_name ?? user.email}
                              </p>
                              {user.is_owner ? (
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                                  Owner
                                </span>
                              ) : user.invitation_pending ? (
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                  Pending
                                </span>
                              ) : null}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {user.is_owner ? (
                          <span className="text-xs font-medium text-muted-foreground">
                            Full access to all workspaces
                          </span>
                        ) : (
                          <AccessSummary user={user} workspaceNameById={workspaceNameById} />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!user.is_owner && canWrite ? (
                          <div className="flex items-center justify-end gap-1">
                            {user.invitation_pending ? (
                              <ResendInviteButton
                                email={user.email}
                                displayName={user.display_name ?? undefined}
                                accountId={accountId}
                                asStaff
                              />
                            ) : null}
                            <Tooltip label="Advanced permissions">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0"
                                aria-label="Advanced permissions"
                                onClick={() => setEditingUser(user)}
                              >
                                <Settings2 className="h-4 w-4" aria-hidden />
                              </Button>
                            </Tooltip>
                            <RemoveUserButton
                              user={user}
                              accountOwnerId={accountId}
                              onRemoved={load}
                              asStaff
                            />
                          </div>
                        ) : null}
                      </td>
                    </tr>
                    {expanded && !user.is_owner && canWrite ? (
                      <tr>
                        <td colSpan={3} className="bg-muted/20 px-4 py-4">
                          <UserAccessEditor
                            user={user}
                            workspaces={workspaces}
                            onSelect={(workspaceId, role) => changeAccess(user, workspaceId, role)}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showInvite ? (
        <InviteUserDialog
          workspaces={workspaces}
          accountId={accountId}
          asStaff
          onClose={() => setShowInvite(false)}
          onInvited={async () => {
            await load();
            setShowInvite(false);
          }}
        />
      ) : null}

      {editingUser ? (
        <EditUserPermissionsDialog
          user={editingUser}
          workspaces={workspaces}
          accountOwnerId={accountId}
          asStaff
          onClose={() => setEditingUser(null)}
          onSaved={async () => {
            await load();
            setEditingUser(null);
          }}
        />
      ) : null}
    </div>
  );
}

function AccessSummary({
  user,
  workspaceNameById,
}: {
  user: AccountUser;
  workspaceNameById: Map<string, string>;
}) {
  const granted = user.workspace_roles;
  if (granted.length === 0) {
    return <span className="text-xs text-muted-foreground">No workspace access</span>;
  }
  const shown = granted.slice(0, 3);
  const extra = granted.length - shown.length;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {shown.map((entry) => (
        <span
          key={entry.workspace_id}
          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground"
        >
          <span className="max-w-[8rem] truncate">{workspaceNameById.get(entry.workspace_id) ?? "Workspace"}</span>
          <span className="text-muted-foreground">· {roleLabel(entry.role)}</span>
        </span>
      ))}
      {extra > 0 ? <span className="text-[11px] font-medium text-muted-foreground">+{extra} more</span> : null}
    </span>
  );
}

function UserAccessEditor({
  user,
  workspaces,
  onSelect,
}: {
  user: AccountUser;
  workspaces: Array<{ id: string; name: string }>;
  onSelect: (workspaceId: string, role: WorkspaceRoleOrNone) => void | Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const roleById = useMemo(
    () => new Map(user.workspace_roles.map((entry) => [entry.workspace_id, entry.role])),
    [user.workspace_roles],
  );
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return workspaces;
    return workspaces.filter((workspace) => workspace.name.toLowerCase().includes(term));
  }, [query, workspaces]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Workspace access for {user.display_name ?? user.email}
        </p>
        {workspaces.length > 6 ? (
          <div className="relative w-full max-w-[14rem]">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search workspaces"
              className="h-8 pl-8 text-xs"
            />
          </div>
        ) : null}
      </div>
      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground">No workspaces match your search.</p>
      ) : (
        <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-md border border-border bg-card">
          {filtered.map((workspace) => (
            <li key={workspace.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0 truncate text-sm text-foreground">{workspace.name}</span>
              <AccessCell
                value={roleById.get(workspace.id) ?? "none"}
                onSelect={(role) => onSelect(workspace.id, role)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
