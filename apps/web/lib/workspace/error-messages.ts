/**
 * Maps raw RPC error codes (e.g. `cannot_modify_owner`) to friendly, human
 * messages. Workspace/account RPCs raise `snake_case` codes via
 * `raise exception`; surfacing those directly looks broken to users.
 */
const FRIENDLY_MESSAGES: Record<string, string> = {
  no_account: "We couldn't find your account. Please sign in again.",
  not_authenticated: "Your session has expired. Please sign in again.",
  forbidden: "You don't have permission to do that.",
  email_required: "Please enter an email address.",
  workspace_name_required: "Please enter a workspace name.",
  workspace_not_found: "That workspace no longer exists.",
  invalid_workspace: "That workspace isn't valid for this account.",
  entity_not_found: "That item no longer exists or isn't part of this account.",
  invalid_entity_type: "That item can't be moved between workspaces.",
  cannot_delete_default_workspace: "The default workspace can't be deleted.",
  workspace_not_empty: "Move or delete the content in this workspace first.",
  cannot_modify_owner: "The account owner's access can't be changed.",
  cannot_remove_owner: "The account owner can't be removed.",
  trial_expired: "Your trial has expired. Upgrade your plan to continue.",
  device_limit_reached: "You've reached the screen limit for your plan.",
  invalid_pairing_code: "That pairing code is invalid or has expired.",
  device_not_found_or_already_linked:
    "That pairing code is invalid, expired, or already linked to another screen.",
  owner_not_found: "We couldn't find the account owner.",
};

const DEFAULT_FALLBACK = "Something went wrong. Please try again.";

const RLS_MESSAGE =
  "You don't have permission to change this playlist. Ask a workspace admin to grant playlist or content access.";

/** Returns a friendly message for a raw Supabase/PostgREST error. */
export function friendlySupabaseError(
  message: string | null | undefined,
  fallback: string = DEFAULT_FALLBACK,
): string {
  if (!message) return fallback;

  const normalized = message.trim();
  const lower = normalized.toLowerCase();

  if (lower.includes("row-level security") || lower.includes("permission denied")) {
    return RLS_MESSAGE;
  }

  return friendlyWorkspaceError(normalized, fallback);
}

/** Returns a friendly message for a raw RPC/API error. */
export function friendlyWorkspaceError(
  message: string | null | undefined,
  fallback: string = DEFAULT_FALLBACK,
): string {
  if (!message) return fallback;

  const normalized = message.trim();
  const lower = normalized.toLowerCase();

  if (lower === "forbidden") return FRIENDLY_MESSAGES.forbidden!;
  if (normalized in FRIENDLY_MESSAGES) return FRIENDLY_MESSAGES[normalized]!;
  if (lower.startsWith("invalid_role")) return "That role isn't valid.";

  // Anything that still looks like a raw snake_case code is hidden behind the
  // fallback rather than shown to the user.
  if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(normalized)) return fallback;

  return normalized;
}
