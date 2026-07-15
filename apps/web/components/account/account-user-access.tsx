"use client";

import type { AccountUser, WorkspacePermission, WorkspaceRole } from "@signage/types";
import { WORKSPACE_ROLE_OPTIONS } from "@signage/types";
import { Loader2, Mail, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip } from "@/components/ui/tooltip";
import {
  WorkspaceRolePicker,
  buildEmptyRolesByWorkspace,
  rolesByWorkspaceFromUser,
  rolesFromWorkspaceEntries,
  type WorkspaceRoleEntry,
} from "@/components/account/workspace-role-picker";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { friendlyWorkspaceError } from "@/lib/workspace/error-messages";

export type WorkspaceRoleOrNone = WorkspaceRole | "none";

export function roleLabel(role: WorkspaceRole): string {
  if (role === "owner") return "Account owner";
  return WORKSPACE_ROLE_OPTIONS.find((option) => option.role === role)?.label ?? role;
}

/** Full desired role set for a pending invite after one cell changes (invite API replaces all). */
function buildInviteRoles(
  user: AccountUser,
  workspaceId: string,
  role: WorkspaceRoleOrNone,
): Array<{ workspace_id: string; role: WorkspaceRole; permissions: WorkspacePermission[] }> {
  const byWorkspace = new Map(
    user.workspace_roles.map((entry) => [
      entry.workspace_id,
      { workspace_id: entry.workspace_id, role: entry.role, permissions: entry.permissions ?? [] },
    ]),
  );
  if (role === "none") {
    byWorkspace.delete(workspaceId);
  } else {
    byWorkspace.set(workspaceId, { workspace_id: workspaceId, role, permissions: [] });
  }
  return [...byWorkspace.values()].map((entry) => ({
    workspace_id: entry.workspace_id,
    role: entry.role,
    permissions: entry.role === "custom" ? entry.permissions : [],
  }));
}

function inviteUserEndpoint(asStaff: boolean) {
  return asStaff ? "/api/admin/invite-account-user" : "/api/account/invite-user";
}

function resendInviteEndpoint(asStaff: boolean) {
  return asStaff ? "/api/admin/resend-account-invite" : "/api/account/resend-invite";
}

/** Sets a single user's role in a single workspace. Throws a friendly error on failure. */
export async function persistWorkspaceAccess({
  accountOwnerId,
  user,
  workspaceId,
  role,
  asStaff = false,
}: {
  accountOwnerId: string;
  user: AccountUser;
  workspaceId: string;
  role: WorkspaceRoleOrNone;
  /** When true, use admin invite APIs for the given account owner. */
  asStaff?: boolean;
}): Promise<void> {
  if (user.invitation_pending) {
    const response = await fetch(inviteUserEndpoint(asStaff), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        ...(asStaff ? { accountId: accountOwnerId } : {}),
        email: user.email,
        roles: buildInviteRoles(user, workspaceId, role),
      }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Could not update access");
    }
    return;
  }
  if (user.user_id) {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("set_member_workspace_roles", {
      p_account_id: accountOwnerId,
      p_user_id: user.user_id,
      p_roles: [{ workspace_id: workspaceId, role, permissions: [] }],
    });
    if (error) {
      throw new Error(friendlyWorkspaceError(error.message));
    }
  }
}

/** Inline role dropdown for one (user, workspace) pair. "Custom…" is surfaced for the caller to handle. */
export function AccessCell({
  value,
  onSelect,
}: {
  value: WorkspaceRoleOrNone;
  onSelect: (role: WorkspaceRoleOrNone) => void | Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const hasCustom = value === "custom";

  return (
    <div className="relative inline-block w-full max-w-[11rem]">
      <select
        className="h-8 w-full rounded-md border border-input bg-background pl-2.5 pr-7 text-xs font-medium text-foreground transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        value={value}
        disabled={saving}
        onChange={(event) => {
          const next = event.target.value as WorkspaceRoleOrNone;
          if (next === value) return;
          setSaving(true);
          void Promise.resolve(onSelect(next)).finally(() => setSaving(false));
        }}
      >
        <option value="none">No access</option>
        {WORKSPACE_ROLE_OPTIONS.filter((option) => option.role !== "custom" || hasCustom).map((option) => (
          <option key={option.role} value={option.role}>
            {option.label}
          </option>
        ))}
        {!hasCustom ? <option value="custom">Custom…</option> : null}
      </select>
      {saving ? (
        <Loader2
          className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground"
          aria-hidden
        />
      ) : null}
    </div>
  );
}

export function ResendInviteButton({
  email,
  displayName,
  accountId,
  asStaff = false,
}: {
  email: string;
  displayName?: string;
  accountId?: string;
  asStaff?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <Tooltip label="Resend invitation">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={loading}
        className="h-8 w-8 p-0"
        aria-label="Resend invitation"
        onClick={() => {
          setLoading(true);
          void (async () => {
            try {
              const response = await fetch(resendInviteEndpoint(asStaff), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({
                  ...(asStaff ? { accountId } : {}),
                  email,
                  displayName,
                }),
              });
              const payload = (await response.json()) as { error?: string; message?: string };
              if (!response.ok) {
                throw new Error(payload.error ?? "Could not resend invitation");
              }
              toast.success(payload.message ?? `Invitation resent to ${email}`);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not resend invitation");
            } finally {
              setLoading(false);
            }
          })();
        }}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Mail className="h-4 w-4" aria-hidden />
        )}
      </Button>
    </Tooltip>
  );
}

export function RemoveUserButton({
  user,
  accountOwnerId,
  onRemoved,
  asStaff = false,
}: {
  user: AccountUser;
  accountOwnerId: string;
  onRemoved: () => void | Promise<void>;
  asStaff?: boolean;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(false);

  return (
    <Tooltip label={user.invitation_pending ? "Cancel invitation" : "Remove user"}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={loading}
        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
        aria-label={user.invitation_pending ? "Cancel invitation" : "Remove user"}
        onClick={() => {
          if (
            !window.confirm(
              user.invitation_pending
                ? `Cancel the invitation for ${user.email}?`
                : `Remove ${user.display_name ?? user.email} from this account?`,
            )
          ) {
            return;
          }

          setLoading(true);
          void (async () => {
            try {
              if (user.invitation_pending) {
                const { error } = asStaff
                  ? await supabase.rpc("admin_revoke_account_invitation", {
                      p_account_id: accountOwnerId,
                      p_email: user.email,
                    })
                  : await supabase.rpc("revoke_account_invitation", { p_email: user.email });
                if (error) throw new Error(friendlyWorkspaceError(error.message));
                toast.success("Invitation cancelled");
              } else if (user.user_id) {
                const { error } = await supabase.rpc("remove_account_user", {
                  p_account_id: accountOwnerId,
                  p_user_id: user.user_id,
                });
                if (error) throw new Error(friendlyWorkspaceError(error.message));
                toast.success("User removed");
              }
              await onRemoved();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not remove user");
            } finally {
              setLoading(false);
            }
          })();
        }}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Trash2 className="h-4 w-4" aria-hidden />
        )}
      </Button>
    </Tooltip>
  );
}

export function InviteUserDialog({
  workspaces,
  onClose,
  onInvited,
  accountId,
  asStaff = false,
}: {
  workspaces: Array<{ id: string; name: string }>;
  onClose: () => void;
  onInvited: () => void | Promise<void>;
  accountId?: string;
  asStaff?: boolean;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [rolesByWorkspace, setRolesByWorkspace] = useState<Record<string, WorkspaceRoleEntry>>(() =>
    buildEmptyRolesByWorkspace(workspaces),
  );
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const roles = rolesFromWorkspaceEntries(rolesByWorkspace, workspaces);
      const response = await fetch(inviteUserEndpoint(asStaff), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ...(asStaff ? { accountId } : {}),
          email: email.trim(),
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          roles,
        }),
      });
      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        toast.error(payload.error ?? "Could not send invitation");
        return;
      }
      toast.success(payload.message ?? "Invitation sent");
      await onInvited();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <UserRolesDialogShell
      title="Add user"
      description="They will receive an email with an activation link."
      onClose={onClose}
      submitting={submitting}
      submitLabel="Send invite"
      onSubmit={() => void submit()}
      submitDisabled={!email.trim()}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="invite-first-name">First name</Label>
          <Input id="invite-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-last-name">Last name</Label>
          <Input id="invite-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <Label htmlFor="invite-email">Email address</Label>
        <Input
          id="invite-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <WorkspaceRoleFields
        workspaces={workspaces}
        rolesByWorkspace={rolesByWorkspace}
        onChange={setRolesByWorkspace}
      />
    </UserRolesDialogShell>
  );
}

export function EditUserPermissionsDialog({
  user,
  workspaces,
  accountOwnerId,
  onClose,
  onSaved,
  asStaff = false,
}: {
  user: AccountUser;
  workspaces: Array<{ id: string; name: string }>;
  accountOwnerId: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  asStaff?: boolean;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [rolesByWorkspace, setRolesByWorkspace] = useState<Record<string, WorkspaceRoleEntry>>(() =>
    rolesByWorkspaceFromUser(workspaces, user.workspace_roles),
  );
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const roles = rolesFromWorkspaceEntries(rolesByWorkspace, workspaces);

      if (user.invitation_pending) {
        const response = await fetch(inviteUserEndpoint(asStaff), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            ...(asStaff ? { accountId: accountOwnerId } : {}),
            email: user.email,
            roles,
          }),
        });
        const payload = (await response.json()) as { error?: string; message?: string };
        if (!response.ok) {
          toast.error(payload.error ?? "Could not update invitation");
          return;
        }
        toast.success(payload.message ?? "Invitation updated");
      } else if (user.user_id) {
        const { error } = await supabase.rpc("set_member_workspace_roles", {
          p_account_id: accountOwnerId,
          p_user_id: user.user_id,
          p_roles: roles,
        });
        if (error) {
          toast.error(friendlyWorkspaceError(error.message));
          return;
        }
        toast.success("Permissions updated");
      }

      await onSaved();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <UserRolesDialogShell
      title="Change permissions"
      description={`Set workspace access for ${user.display_name ?? user.email}.`}
      onClose={onClose}
      submitting={submitting}
      submitLabel="Save changes"
      onSubmit={() => void submit()}
    >
      <WorkspaceRoleFields
        workspaces={workspaces}
        rolesByWorkspace={rolesByWorkspace}
        onChange={setRolesByWorkspace}
      />
    </UserRolesDialogShell>
  );
}

function WorkspaceRoleFields({
  workspaces,
  rolesByWorkspace,
  onChange,
}: {
  workspaces: Array<{ id: string; name: string }>;
  rolesByWorkspace: Record<string, WorkspaceRoleEntry>;
  onChange: (next: Record<string, WorkspaceRoleEntry>) => void;
}) {
  return (
    <div className="mt-5 space-y-4">
      {workspaces.map((workspace) => {
        const entry = rolesByWorkspace[workspace.id]!;
        return (
          <WorkspaceRolePicker
            key={workspace.id}
            workspaceName={workspace.name}
            entry={entry}
            onChange={(next) => onChange({ ...rolesByWorkspace, [workspace.id]: next })}
          />
        );
      })}
    </div>
  );
}

function UserRolesDialogShell({
  title,
  description,
  onClose,
  submitting,
  submitLabel,
  onSubmit,
  submitDisabled,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  submitting: boolean;
  submitLabel: string;
  onSubmit: () => void;
  submitDisabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={submitting || submitDisabled} onClick={onSubmit}>
            {submitting ? "Saving…" : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
