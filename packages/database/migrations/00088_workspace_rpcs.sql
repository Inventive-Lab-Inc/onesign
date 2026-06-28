-- Workspace & account-user management RPCs (Phase 2).
--
-- All writes to workspaces / account_members / workspace_members go through
-- these SECURITY DEFINER functions, guarded by account-owner / administrator
-- checks. The tables themselves expose only SELECT policies (see 00086).

-- ---------------------------------------------------------------------------
-- Account invitations (invite a user by email into an account + workspace roles)
-- ---------------------------------------------------------------------------
create table if not exists public.account_invitations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles (id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  first_name text,
  last_name text,
  -- Desired per-workspace roles applied on accept:
  -- [{ "workspace_id": uuid, "role": text, "permissions": text[] }, ...]
  workspace_roles jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index if not exists account_invitations_account_id_idx on public.account_invitations (account_id);
create index if not exists account_invitations_email_lower_idx on public.account_invitations (lower(email));
create unique index if not exists account_invitations_pending_email_account_key
  on public.account_invitations (account_id, lower(email))
  where status = 'pending';

alter table public.account_invitations enable row level security;

drop policy if exists account_invitations_select on public.account_invitations;
create policy account_invitations_select on public.account_invitations
  for select using (
    account_id in (select public.current_account_ids())
    or lower(email) = lower((select u.email from auth.users u where u.id = auth.uid()))
    or public.is_platform_staff()
  );

comment on table public.account_invitations is
  'Invitations to join an account with per-workspace roles; applied on first sign-in.';

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------

-- The account the current user works in: the one they own, else any membership.
create or replace function public.primary_account_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select am.account_id from public.account_members am
       where am.user_id = auth.uid() and am.is_owner limit 1),
    (select am.account_id from public.account_members am
       where am.user_id = auth.uid() order by am.created_at asc limit 1)
  );
$$;

revoke all on function public.primary_account_id() from public;
grant execute on function public.primary_account_id() to authenticated;

create or replace function public.is_account_owner(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.account_members am
    where am.account_id = p_account_id
      and am.user_id = auth.uid()
      and am.is_owner
  );
$$;

revoke all on function public.is_account_owner(uuid) from public;
grant execute on function public.is_account_owner(uuid) to authenticated;

-- Can manage users/workspaces: account owner, or holds 'administrator' in any
-- workspace of the account.
create or replace function public.can_admin_account(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_account_owner(p_account_id)
    or exists (
      select 1
      from public.workspace_members wm
      join public.workspaces w on w.id = wm.workspace_id
      where w.account_id = p_account_id
        and wm.user_id = auth.uid()
        and public.workspace_permission_granted(wm.role, wm.permissions, 'administrator')
    );
$$;

revoke all on function public.can_admin_account(uuid) from public;
grant execute on function public.can_admin_account(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Workspace CRUD (account owner only — mirrors the product rule)
-- ---------------------------------------------------------------------------
create or replace function public.create_workspace(p_name text)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid := public.primary_account_id();
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_row public.workspaces;
begin
  if v_account_id is null then
    raise exception 'no_account';
  end if;
  if not public.is_account_owner(v_account_id) then
    raise exception 'forbidden';
  end if;
  if v_name is null then
    raise exception 'workspace_name_required';
  end if;

  insert into public.workspaces (account_id, name, is_default)
  values (v_account_id, v_name, false)
  returning * into v_row;

  -- Owner is automatically an owner-member of every workspace they create.
  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_row.id, auth.uid(), 'owner')
  on conflict (workspace_id, user_id) do nothing;

  return v_row;
end;
$$;

revoke all on function public.create_workspace(text) from public;
grant execute on function public.create_workspace(text) to authenticated;

create or replace function public.rename_workspace(p_workspace_id uuid, p_name text)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_row public.workspaces;
begin
  select account_id into v_account_id from public.workspaces where id = p_workspace_id;
  if v_account_id is null then
    raise exception 'workspace_not_found';
  end if;
  if not public.is_account_owner(v_account_id) then
    raise exception 'forbidden';
  end if;
  if v_name is null then
    raise exception 'workspace_name_required';
  end if;

  update public.workspaces set name = v_name where id = p_workspace_id returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.rename_workspace(uuid, text) from public;
grant execute on function public.rename_workspace(uuid, text) to authenticated;

-- Delete a workspace. Refuses to delete the default workspace or one that still
-- holds content (caller must move/delete content first).
create or replace function public.delete_workspace(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
  v_is_default boolean;
  v_content_count integer;
begin
  select account_id, is_default into v_account_id, v_is_default
  from public.workspaces where id = p_workspace_id;

  if v_account_id is null then
    raise exception 'workspace_not_found';
  end if;
  if not public.is_account_owner(v_account_id) then
    raise exception 'forbidden';
  end if;
  if v_is_default then
    raise exception 'cannot_delete_default_workspace';
  end if;

  select
    (select count(*) from public.devices where workspace_id = p_workspace_id)
    + (select count(*) from public.media where workspace_id = p_workspace_id)
    + (select count(*) from public.playlists where workspace_id = p_workspace_id)
    + (select count(*) from public.websites where workspace_id = p_workspace_id)
  into v_content_count;

  if v_content_count > 0 then
    raise exception 'workspace_not_empty';
  end if;

  delete from public.workspaces where id = p_workspace_id;
end;
$$;

revoke all on function public.delete_workspace(uuid) from public;
grant execute on function public.delete_workspace(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Account users directory (Users tab)
-- ---------------------------------------------------------------------------
create or replace function public.list_account_users()
returns table (
  user_id uuid,
  email text,
  display_name text,
  is_owner boolean,
  invitation_pending boolean,
  workspace_roles jsonb
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_account_id uuid := public.primary_account_id();
begin
  if v_account_id is null then
    raise exception 'no_account';
  end if;
  if not public.can_admin_account(v_account_id) then
    raise exception 'forbidden';
  end if;

  return query
  -- Existing members
  select
    am.user_id,
    u.email::text,
    coalesce(nullif(trim(p.client_name), ''), split_part(u.email, '@', 1)) as display_name,
    am.is_owner,
    false as invitation_pending,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'workspace_id', wm.workspace_id,
        'role', wm.role,
        'permissions', wm.permissions
      ))
      from public.workspace_members wm
      join public.workspaces w on w.id = wm.workspace_id
      where w.account_id = v_account_id and wm.user_id = am.user_id
    ), '[]'::jsonb) as workspace_roles
  from public.account_members am
  join auth.users u on u.id = am.user_id
  left join public.profiles p on p.id = am.user_id
  where am.account_id = v_account_id

  union all

  -- Pending invitations (no member row yet)
  select
    null::uuid as user_id,
    ai.email::text,
    nullif(trim(concat_ws(' ', ai.first_name, ai.last_name)), '') as display_name,
    false as is_owner,
    true as invitation_pending,
    ai.workspace_roles
  from public.account_invitations ai
  where ai.account_id = v_account_id
    and ai.status = 'pending'
    and not exists (
      select 1 from public.account_members am2
      join auth.users u2 on u2.id = am2.user_id
      where am2.account_id = v_account_id and lower(u2.email) = lower(ai.email)
    )
  order by is_owner desc, display_name asc;
end;
$$;

revoke all on function public.list_account_users() from public;
grant execute on function public.list_account_users() to authenticated;

-- ---------------------------------------------------------------------------
-- Apply per-workspace roles for a user within the current account.
-- p_roles: jsonb array of { workspace_id, role, permissions[] }.
-- A workspace omitted (or role 'none') removes access for that workspace.
-- ---------------------------------------------------------------------------
create or replace function public.set_member_workspace_roles(
  p_account_id uuid,
  p_user_id uuid,
  p_roles jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry jsonb;
  v_workspace_id uuid;
  v_role text;
  v_perms text[];
begin
  if not public.can_admin_account(p_account_id) then
    raise exception 'forbidden';
  end if;

  -- Never allow changing the account owner's roles via this path.
  if exists (
    select 1 from public.account_members am
    where am.account_id = p_account_id and am.user_id = p_user_id and am.is_owner
  ) then
    raise exception 'cannot_modify_owner';
  end if;

  for v_entry in select * from jsonb_array_elements(coalesce(p_roles, '[]'::jsonb)) loop
    v_workspace_id := (v_entry->>'workspace_id')::uuid;
    v_role := v_entry->>'role';

    -- Workspace must belong to this account.
    if not exists (
      select 1 from public.workspaces w
      where w.id = v_workspace_id and w.account_id = p_account_id
    ) then
      continue;
    end if;

    if v_role is null or v_role = 'none' then
      delete from public.workspace_members
      where workspace_id = v_workspace_id and user_id = p_user_id;
      continue;
    end if;

    if v_role not in ('account_admin', 'admin', 'standard', 'content_manager', 'custom') then
      raise exception 'invalid_role: %', v_role;
    end if;

    v_perms := coalesce(
      (select array_agg(value::text) from jsonb_array_elements_text(v_entry->'permissions')),
      '{}'::text[]
    );

    insert into public.workspace_members (workspace_id, user_id, role, permissions)
    values (v_workspace_id, p_user_id, v_role, v_perms)
    on conflict (workspace_id, user_id)
      do update set role = excluded.role, permissions = excluded.permissions;
  end loop;
end;
$$;

revoke all on function public.set_member_workspace_roles(uuid, uuid, jsonb) from public;
grant execute on function public.set_member_workspace_roles(uuid, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Invite a user by email into the current account with per-workspace roles.
-- If the email already has an account, they are added as a member immediately;
-- otherwise a pending invitation is recorded and applied on first sign-in.
-- ---------------------------------------------------------------------------
create or replace function public.invite_account_user(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_roles jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_account_id uuid := public.primary_account_id();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_user_id uuid;
  v_invitation_id uuid;
begin
  if v_account_id is null then
    raise exception 'no_account';
  end if;
  if not public.can_admin_account(v_account_id) then
    raise exception 'forbidden';
  end if;
  if v_email = '' then
    raise exception 'email_required';
  end if;

  select u.id into v_user_id from auth.users u where lower(u.email) = v_email limit 1;

  if v_user_id is not null then
    -- Existing user: add as account member + apply roles now.
    insert into public.account_members (account_id, user_id, is_owner)
    values (v_account_id, v_user_id, false)
    on conflict (account_id, user_id) do nothing;

    perform public.set_member_workspace_roles(v_account_id, v_user_id, p_roles);
  end if;

  -- Always record the invitation (pending until they sign in / accept).
  insert into public.account_invitations (account_id, email, invited_by, user_id, first_name, last_name, workspace_roles, status)
  values (
    v_account_id,
    v_email,
    auth.uid(),
    v_user_id,
    nullif(trim(coalesce(p_first_name, '')), ''),
    nullif(trim(coalesce(p_last_name, '')), ''),
    coalesce(p_roles, '[]'::jsonb),
    case when v_user_id is not null then 'accepted' else 'pending' end
  )
  on conflict (account_id, lower(email)) where (status = 'pending')
    do update set
      invited_by = excluded.invited_by,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      workspace_roles = excluded.workspace_roles,
      created_at = now()
  returning id into v_invitation_id;

  return v_invitation_id;
end;
$$;

revoke all on function public.invite_account_user(text, text, text, jsonb) from public;
grant execute on function public.invite_account_user(text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Remove a user from the account (and all its workspaces). Cannot remove owner.
-- ---------------------------------------------------------------------------
create or replace function public.remove_account_user(p_account_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_admin_account(p_account_id) then
    raise exception 'forbidden';
  end if;
  if exists (
    select 1 from public.account_members am
    where am.account_id = p_account_id and am.user_id = p_user_id and am.is_owner
  ) then
    raise exception 'cannot_remove_owner';
  end if;

  delete from public.workspace_members wm
  using public.workspaces w
  where wm.workspace_id = w.id
    and w.account_id = p_account_id
    and wm.user_id = p_user_id;

  delete from public.account_members
  where account_id = p_account_id and user_id = p_user_id;

  update public.account_invitations
  set status = 'revoked'
  where account_id = p_account_id and lower(email) = lower((
    select u.email from auth.users u where u.id = p_user_id
  )) and status = 'pending';
end;
$$;

revoke all on function public.remove_account_user(uuid, uuid) from public;
grant execute on function public.remove_account_user(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Accept pending invitations for the signed-in user (call on first sign-in).
-- Attaches account membership and applies the invited per-workspace roles.
-- ---------------------------------------------------------------------------
create or replace function public.accept_account_invitations()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  rec record;
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = auth.uid();
  if v_email is null then
    return 0;
  end if;

  for rec in
    select * from public.account_invitations
    where status = 'pending' and lower(email) = v_email
  loop
    insert into public.account_members (account_id, user_id, is_owner)
    values (rec.account_id, auth.uid(), false)
    on conflict (account_id, user_id) do nothing;

    perform public.set_member_workspace_roles_internal(rec.account_id, auth.uid(), rec.workspace_roles);

    update public.account_invitations
    set status = 'accepted', accepted_at = now(), user_id = auth.uid()
    where id = rec.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.accept_account_invitations() from public;
grant execute on function public.accept_account_invitations() to authenticated;

-- Internal variant of set_member_workspace_roles that skips the can_admin check
-- (used by accept flow, where the acting user is the invitee themselves).
create or replace function public.set_member_workspace_roles_internal(
  p_account_id uuid,
  p_user_id uuid,
  p_roles jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry jsonb;
  v_workspace_id uuid;
  v_role text;
  v_perms text[];
begin
  for v_entry in select * from jsonb_array_elements(coalesce(p_roles, '[]'::jsonb)) loop
    v_workspace_id := (v_entry->>'workspace_id')::uuid;
    v_role := v_entry->>'role';

    if not exists (
      select 1 from public.workspaces w
      where w.id = v_workspace_id and w.account_id = p_account_id
    ) then
      continue;
    end if;

    if v_role is null or v_role = 'none' then
      continue;
    end if;
    if v_role not in ('account_admin', 'admin', 'standard', 'content_manager', 'custom') then
      continue;
    end if;

    v_perms := coalesce(
      (select array_agg(value::text) from jsonb_array_elements_text(v_entry->'permissions')),
      '{}'::text[]
    );

    insert into public.workspace_members (workspace_id, user_id, role, permissions)
    values (v_workspace_id, p_user_id, v_role, v_perms)
    on conflict (workspace_id, user_id)
      do update set role = excluded.role, permissions = excluded.permissions;
  end loop;
end;
$$;

revoke all on function public.set_member_workspace_roles_internal(uuid, uuid, jsonb) from public;
-- Only callable by other SECURITY DEFINER functions; not granted to clients.
