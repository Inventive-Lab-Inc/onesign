-- Workspace security hardening (advisor follow-ups).
--
-- 1. set_member_workspace_roles_internal() skips the can_admin_account check
--    (it is only meant to be called by accept_account_invitations for the
--    invitee themselves). Supabase grants EXECUTE on new functions to anon /
--    authenticated by default, so we must explicitly revoke it to prevent a
--    client from calling it directly and self-assigning any workspace role.
-- 2. workspace_permission_granted() was missing a fixed search_path.

revoke execute on function public.set_member_workspace_roles_internal(uuid, uuid, jsonb) from public, anon, authenticated;

create or replace function public.workspace_permission_granted(
  p_role text,
  p_permissions text[],
  p_permission text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_role in ('owner', 'account_admin') then true
    when p_role = 'admin' then p_permission <> 'access_billing'
    when p_role = 'standard' then p_permission in (
      'view_screens', 'manage_screens', 'change_playlists',
      'view_content', 'manage_content', 'view_websites', 'manage_websites'
    )
    when p_role = 'content_manager' then p_permission in (
      'view_content', 'manage_content', 'view_websites', 'manage_websites', 'change_playlists'
    )
    when p_role = 'custom' then p_permission = any(coalesce(p_permissions, '{}'::text[]))
    else false
  end;
$$;
