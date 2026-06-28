"use client";

import type { ReactNode } from "react";
import type { WorkspacePermission } from "@signage/types";
import { Tooltip } from "@/components/ui/tooltip";
import { HeaderPrimaryButton } from "@/components/console/header-primary-button";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useWorkspaceOptional } from "@/components/workspace/workspace-provider";

/**
 * Per-permission explanation shown when a workspace member lacks the access an
 * action requires. Keeps the wording action-oriented so users know what to ask
 * a workspace admin for.
 */
const PERMISSION_HINTS: Partial<Record<WorkspacePermission, string>> = {
  manage_screens: "You only have view access to screens.\nAsk a workspace admin to grant edit access.",
  change_playlists: "You can't change playlists here.\nAsk a workspace admin to grant access.",
  manage_content: "You only have view access to content.\nAsk a workspace admin to grant edit access.",
  manage_websites: "You only have view access to websites.\nAsk a workspace admin to grant edit access.",
  administrator: "This action needs administrator access.\nAsk a workspace admin to grant it.",
  access_billing: "You don't have access to billing.\nAsk the account owner for access.",
};

const DEFAULT_HINT = "You don't have permission for this action.\nAsk a workspace admin to grant access.";

/** Friendly explanation for a missing workspace permission. */
export function permissionHint(permission: WorkspacePermission): string {
  return PERMISSION_HINTS[permission] ?? DEFAULT_HINT;
}

/**
 * Whether the signed-in member holds a permission in the active workspace.
 *
 * Defaults to `true` whenever there is no workspace scoping in play (e.g. the
 * admin portal, or before the account context has loaded) so non-workspace
 * surfaces and the initial render are never blocked.
 */
export function useWorkspacePermission(permission: WorkspacePermission): boolean {
  const ctx = useWorkspaceOptional();
  if (!ctx || !ctx.ready) return true;
  if (ctx.workspaces.length === 0) return true;
  if (!ctx.activeWorkspace) return true;
  return ctx.hasPermission(permission);
}

/** Wraps children in a hover/focus tooltip explaining why an action is blocked. */
export function PermissionTooltip({
  reason,
  className,
  children,
}: {
  reason: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip label={reason} className={className} placement="right" multiline>
      {children}
    </Tooltip>
  );
}

interface GatedHeaderButtonProps extends Omit<ButtonProps, "children"> {
  permission: WorkspacePermission;
  label: string;
  icon: ReactNode;
}

/**
 * Header CTA that stays visible but is disabled, with an explanatory tooltip,
 * when the member lacks the required workspace permission.
 */
export function GatedHeaderButton({
  permission,
  label,
  icon,
  disabled = false,
  onClick,
  ...rest
}: GatedHeaderButtonProps) {
  const allowed = useWorkspacePermission(permission);
  const button = (
    <HeaderPrimaryButton
      label={label}
      icon={icon}
      disabled={disabled || !allowed}
      onClick={allowed ? onClick : undefined}
      {...rest}
    />
  );
  if (allowed) return button;
  return <PermissionTooltip reason={permissionHint(permission)}>{button}</PermissionTooltip>;
}

interface GatedButtonProps extends ButtonProps {
  permission: WorkspacePermission;
}

/** Standard button that stays visible but disabled with a tooltip when permission is missing. */
export function GatedButton({
  permission,
  disabled = false,
  onClick,
  children,
  ...rest
}: GatedButtonProps) {
  const allowed = useWorkspacePermission(permission);
  const button = (
    <Button disabled={disabled || !allowed} onClick={allowed ? onClick : undefined} {...rest}>
      {children}
    </Button>
  );
  if (allowed) return button;
  return <PermissionTooltip reason={permissionHint(permission)}>{button}</PermissionTooltip>;
}
