-- Platform staff can list and manage a client's account users (sub-agents / teammates).

-- Allow staff writers to update member roles and remove users for any account.
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
  if not (
    public.can_admin_account(p_account_id)
    or public.is_platform_staff_writer()
  ) then
    raise exception 'forbidden';
  end if;

  if exists (
    select 1 from public.account_members am
    where am.account_id = p_account_id and am.user_id = p_user_id and am.is_owner
  ) then
    raise exception 'cannot_modify_owner';
  end if;

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

create or replace function public.remove_account_user(p_account_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.can_admin_account(p_account_id)
    or public.is_platform_staff_writer()
  ) then
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

create or replace function public.admin_list_account_users(p_account_id uuid)
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
begin
  if p_account_id is null then
    raise exception 'account_required';
  end if;
  if not public.is_platform_staff() then
    raise exception 'forbidden';
  end if;

  return query
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
      where w.account_id = p_account_id and wm.user_id = am.user_id
    ), '[]'::jsonb) as workspace_roles
  from public.account_members am
  join auth.users u on u.id = am.user_id
  left join public.profiles p on p.id = am.user_id
  where am.account_id = p_account_id

  union all

  select
    null::uuid as user_id,
    ai.email::text,
    nullif(trim(concat_ws(' ', ai.first_name, ai.last_name)), '') as display_name,
    false as is_owner,
    true as invitation_pending,
    ai.workspace_roles
  from public.account_invitations ai
  where ai.account_id = p_account_id
    and ai.status = 'pending'
    and not exists (
      select 1 from public.account_members am2
      join auth.users u2 on u2.id = am2.user_id
      where am2.account_id = p_account_id and lower(u2.email) = lower(ai.email)
    )
  order by is_owner desc, display_name asc;
end;
$$;

revoke all on function public.admin_list_account_users(uuid) from public;
grant execute on function public.admin_list_account_users(uuid) to authenticated;

create or replace function public.admin_invite_account_user(
  p_account_id uuid,
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
  v_email text := lower(trim(coalesce(p_email, '')));
  v_user_id uuid;
  v_invitation_id uuid;
begin
  if p_account_id is null then
    raise exception 'account_required';
  end if;
  if not public.is_platform_staff_writer() then
    raise exception 'forbidden';
  end if;
  if v_email = '' then
    raise exception 'email_required';
  end if;

  if not exists (select 1 from public.profiles where id = p_account_id) then
    raise exception 'account_not_found';
  end if;

  select u.id into v_user_id from auth.users u where lower(u.email) = v_email limit 1;

  if v_user_id is not null then
    insert into public.account_members (account_id, user_id, is_owner)
    values (p_account_id, v_user_id, false)
    on conflict (account_id, user_id) do nothing;

    perform public.set_member_workspace_roles(p_account_id, v_user_id, p_roles);
  end if;

  insert into public.account_invitations (account_id, email, invited_by, user_id, first_name, last_name, workspace_roles, status)
  values (
    p_account_id,
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

revoke all on function public.admin_invite_account_user(uuid, text, text, text, jsonb) from public;
grant execute on function public.admin_invite_account_user(uuid, text, text, text, jsonb) to authenticated;

create or replace function public.admin_revoke_account_invitation(p_account_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if p_account_id is null then
    raise exception 'account_required';
  end if;
  if not public.is_platform_staff_writer() then
    raise exception 'forbidden';
  end if;
  if v_email = '' then
    raise exception 'email_required';
  end if;

  update public.account_invitations
  set status = 'revoked'
  where account_id = p_account_id
    and lower(email) = v_email
    and status = 'pending';
end;
$$;

revoke all on function public.admin_revoke_account_invitation(uuid, text) from public;
grant execute on function public.admin_revoke_account_invitation(uuid, text) to authenticated;
