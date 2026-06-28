"use client";

import type { AccountUser, WorkspaceRole } from "@signage/types";
import { WORKSPACE_ROLE_OPTIONS } from "@signage/types";
import { Boxes, Loader2, Search, Settings, Settings2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AccessCell,
  EditUserPermissionsDialog,
  RemoveUserButton,
  ResendInviteButton,
  persistWorkspaceAccess,
  type WorkspaceRoleOrNone,
} from "@/components/account/account-user-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip } from "@/components/ui/tooltip";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { friendlyWorkspaceError } from "@/lib/workspace/error-messages";

type WorkspaceStats = {
  id: string;
  name: string;
  is_default: boolean;
  screen_count: number;
  media_count: number;
  user_count: number;
};

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function AccountWorkspacesPanel() {
  const { accountOwnerId, isAccountOwner, canAdminAccount, refreshWorkspaces } = useWorkspace();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [workspaces, setWorkspaces] = useState<WorkspaceStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [manageWorkspace, setManageWorkspace] = useState<WorkspaceStats | null>(null);

  const loadWorkspaces = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_account_workspaces");
    if (error) {
      toast.error(friendlyWorkspaceError(error.message));
      setLoading(false);
      return;
    }
    setWorkspaces((data as WorkspaceStats[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (canAdminAccount) {
      void loadWorkspaces();
    } else {
      setLoading(false);
    }
  }, [canAdminAccount, loadWorkspaces]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return workspaces;
    return workspaces.filter((workspace) => workspace.name.toLowerCase().includes(query));
  }, [workspaces, search]);

  if (!canAdminAccount) {
    return (
      <p className="text-sm text-muted-foreground">
        You do not have permission to manage workspaces for this account.
      </p>
    );
  }

  async function deleteWorkspace(workspace: WorkspaceStats): Promise<boolean> {
    if (!window.confirm(`Delete "${workspace.name}"? It must be empty first.`)) return false;
    const { error } = await supabase.rpc("delete_workspace", { p_workspace_id: workspace.id });
    if (error) {
      toast.error(friendlyWorkspaceError(error.message));
      return false;
    }
    toast.success("Workspace deleted");
    await Promise.all([loadWorkspaces(), refreshWorkspaces()]);
    return true;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {isAccountOwner ? (
          <Button type="button" variant="outline" onClick={() => setCreateOpen(true)}>
            Add Workspace
          </Button>
        ) : (
          <span />
        )}
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search"
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading workspaces…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {search.trim() ? "No workspaces match your search." : "No workspaces yet."}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {filtered.map((workspace) => (
            <li key={workspace.id} className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() => setManageWorkspace(workspace)}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white"
                  aria-hidden
                >
                  <Boxes className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{workspace.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {countLabel(workspace.screen_count, "screen")} ·{" "}
                    {countLabel(workspace.media_count, "Media file")} ·{" "}
                    {countLabel(workspace.user_count, "User")}
                  </span>
                </span>
              </button>
              {workspace.is_default ? (
                <span className="rounded-md bg-brand px-2.5 py-0.5 text-xs font-semibold text-white">
                  Default
                </span>
              ) : null}
              <Tooltip label={isAccountOwner ? "Workspace settings" : "View users"}>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 shrink-0 p-0"
                  aria-label={`${isAccountOwner ? "Settings" : "View users"} for ${workspace.name}`}
                  onClick={() => setManageWorkspace(workspace)}
                >
                  <Settings className="h-4 w-4" aria-hidden />
                </Button>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}

      {createOpen ? (
        <WorkspaceCreateDialog
          onClose={() => setCreateOpen(false)}
          onSubmit={async (value) => {
            const { error } = await supabase.rpc("create_workspace", { p_name: value });
            if (error) {
              toast.error(friendlyWorkspaceError(error.message));
              return false;
            }
            toast.success("Workspace created");
            await Promise.all([loadWorkspaces(), refreshWorkspaces()]);
            return true;
          }}
        />
      ) : null}

      {manageWorkspace ? (
        <WorkspaceManageDialog
          workspace={manageWorkspace}
          canEdit={isAccountOwner}
          accountOwnerId={accountOwnerId}
          allWorkspaces={workspaces}
          onClose={() => setManageWorkspace(null)}
          onChanged={async () => {
            await Promise.all([loadWorkspaces(), refreshWorkspaces()]);
          }}
          onDelete={
            isAccountOwner && !manageWorkspace.is_default
              ? async () => {
                  const deleted = await deleteWorkspace(manageWorkspace);
                  if (deleted) setManageWorkspace(null);
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

function WorkspaceManageDialog({
  workspace,
  canEdit,
  accountOwnerId,
  allWorkspaces,
  onClose,
  onChanged,
  onDelete,
}: {
  workspace: WorkspaceStats;
  canEdit: boolean;
  accountOwnerId: string;
  allWorkspaces: Array<{ id: string; name: string }>;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [name, setName] = useState(workspace.name);
  const [savingName, setSavingName] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [users, setUsers] = useState<AccountUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AccountUser | null>(null);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    const { data, error } = await supabase.rpc("list_account_users");
    if (error) {
      toast.error(friendlyWorkspaceError(error.message));
      setLoadingUsers(false);
      return;
    }
    setUsers((data as AccountUser[]) ?? []);
    setLoadingUsers(false);
  }, [supabase]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const workspaceUsers = useMemo(
    () =>
      users
        .map((user) => ({
          user,
          role: user.workspace_roles.find((entry) => entry.workspace_id === workspace.id)?.role ?? null,
        }))
        .filter((entry) => entry.role != null),
    [users, workspace.id],
  );

  const changeUserRole = useCallback(
    async (user: AccountUser, role: WorkspaceRoleOrNone) => {
      if (role === "custom") {
        setEditingUser(user);
        return;
      }
      try {
        await persistWorkspaceAccess({ accountOwnerId, user, workspaceId: workspace.id, role });
        toast.success("Access updated");
        await Promise.all([loadUsers(), onChanged()]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update access");
      }
    },
    [accountOwnerId, loadUsers, onChanged, workspace.id],
  );

  const nameChanged = name.trim() !== workspace.name && name.trim().length > 0;

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Enter a workspace name.");
      return;
    }
    setSavingName(true);
    try {
      const { error } = await supabase.rpc("rename_workspace", {
        p_workspace_id: workspace.id,
        p_name: trimmed,
      });
      if (error) {
        toast.error(friendlyWorkspaceError(error.message));
        return;
      }
      toast.success("Workspace updated");
      await onChanged();
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-card p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white"
              aria-hidden
            >
              <Boxes className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-foreground">{workspace.name}</h2>
              <p className="text-xs text-muted-foreground">
                {countLabel(workspace.screen_count, "screen")} · {countLabel(workspace.media_count, "Media file")}
              </p>
            </div>
          </div>
          <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={onClose}>
            Close
          </button>
        </div>

        {canEdit ? (
          <div className="space-y-1.5">
            <Label htmlFor="manage-workspace-name">Workspace name</Label>
            <div className="flex gap-2">
              <Input
                id="manage-workspace-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. London stores"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && nameChanged) void saveName();
                }}
              />
              <Button type="button" disabled={!nameChanged || savingName} onClick={() => void saveName()}>
                {savingName ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        ) : null}

        <div className={canEdit ? "mt-6" : ""}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">
              Users with access ({workspaceUsers.length})
            </p>
            <Button type="button" size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              Add user
            </Button>
          </div>
          {loadingUsers ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading users…
            </div>
          ) : workspaceUsers.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
              No users have access to this workspace yet.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {workspaceUsers.map(({ user, role }) => (
                <li key={user.user_id ?? user.email} className="flex items-center gap-3 px-4 py-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white"
                    aria-hidden
                  >
                    {(user.display_name ?? user.email).slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {user.display_name ?? user.email}
                      </p>
                      {user.invitation_pending ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          Pending
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  {user.is_owner ? (
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                      Account owner
                    </span>
                  ) : (
                    <>
                      <AccessCell
                        value={role ?? "none"}
                        onSelect={(next) => changeUserRole(user, next)}
                      />
                      <div className="flex shrink-0 items-center gap-1">
                        {user.invitation_pending ? (
                          <ResendInviteButton email={user.email} displayName={user.display_name ?? undefined} />
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
                        <RemoveUserButton user={user} accountOwnerId={accountOwnerId} onRemoved={loadUsers} />
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          {onDelete ? (
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              className="gap-2 text-destructive hover:text-destructive"
              onClick={() => {
                setDeleting(true);
                void onDelete().finally(() => setDeleting(false));
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              {deleting ? "Deleting…" : "Delete workspace"}
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>

      {addOpen ? (
        <AddUserToWorkspaceDialog
          workspaceName={workspace.name}
          workspaceId={workspace.id}
          onClose={() => setAddOpen(false)}
          onAdded={async () => {
            await Promise.all([loadUsers(), onChanged()]);
            setAddOpen(false);
          }}
        />
      ) : null}

      {editingUser ? (
        <EditUserPermissionsDialog
          user={editingUser}
          workspaces={allWorkspaces}
          accountOwnerId={accountOwnerId}
          onClose={() => setEditingUser(null)}
          onSaved={async () => {
            await Promise.all([loadUsers(), onChanged()]);
            setEditingUser(null);
          }}
        />
      ) : null}
    </div>
  );
}

function AddUserToWorkspaceDialog({
  workspaceName,
  workspaceId,
  onClose,
  onAdded,
}: {
  workspaceName: string;
  workspaceId: string;
  onClose: () => void;
  onAdded: () => Promise<void>;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("standard");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("Enter an email address.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/account/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: trimmedEmail,
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          roles: [{ workspace_id: workspaceId, role, permissions: [] }],
        }),
      });
      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        toast.error(payload.error ?? "Could not add user");
        return;
      }
      toast.success(payload.message ?? "User added");
      await onAdded();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">Add user to {workspaceName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              They will receive an email with an activation link.
            </p>
          </div>
          <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ws-add-first-name">First name</Label>
            <Input id="ws-add-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-add-last-name">Last name</Label>
            <Input id="ws-add-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="ws-add-email">Email address</Label>
          <Input
            id="ws-add-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="ws-add-role">Role in this workspace</Label>
          <select
            id="ws-add-role"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={role}
            onChange={(event) => setRole(event.target.value as WorkspaceRole)}
          >
            {WORKSPACE_ROLE_OPTIONS.filter((option) => option.role !== "custom").map((option) => (
              <option key={option.role} value={option.role}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={submitting || !email.trim()} onClick={() => void submit()}>
            {submitting ? "Adding…" : "Add user"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function WorkspaceCreateDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (value: string) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Enter a workspace name.");
      return;
    }
    setSubmitting(true);
    try {
      const ok = await onSubmit(trimmed);
      if (ok) onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">Add workspace</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Workspaces isolate screens, content, and user permissions within your account.
            </p>
          </div>
          <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="workspace-name">Name</Label>
          <Input
            id="workspace-name"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. London stores"
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={submitting || !name.trim()} onClick={() => void submit()}>
            {submitting ? "Saving…" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}
