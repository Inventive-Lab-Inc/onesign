-- Workspace app integration: list workspaces, move content, link devices with workspace.

-- ---------------------------------------------------------------------------
-- List workspaces the signed-in user can access (for the header selector).
-- ---------------------------------------------------------------------------
create or replace function public.list_my_workspaces()
returns table (
  id uuid,
  account_id uuid,
  name text,
  is_default boolean,
  role text,
  permissions text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    w.id,
    w.account_id,
    w.name,
    w.is_default,
    wm.role,
    wm.permissions
  from public.workspace_members wm
  join public.workspaces w on w.id = wm.workspace_id
  where wm.user_id = auth.uid()
  order by w.is_default desc, w.created_at asc;
$$;

revoke all on function public.list_my_workspaces() from public;
grant execute on function public.list_my_workspaces() to authenticated;

-- ---------------------------------------------------------------------------
-- Move a screen or content row to another workspace within the same account.
-- ---------------------------------------------------------------------------
create or replace function public.move_to_workspace(
  p_entity_type text,
  p_entity_id uuid,
  p_workspace_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
  v_target_account_id uuid;
  v_current_workspace_id uuid;
begin
  select account_id into v_target_account_id from public.workspaces where id = p_workspace_id;
  if v_target_account_id is null then
    raise exception 'workspace_not_found';
  end if;

  if not public.can_admin_account(v_target_account_id)
     and not public.workspace_has_permission(p_workspace_id, 'manage_screens')
     and not public.workspace_has_permission(p_workspace_id, 'manage_content') then
    raise exception 'forbidden';
  end if;

  case p_entity_type
    when 'device' then
      select owner_id, workspace_id into v_account_id, v_current_workspace_id
      from public.devices where id = p_entity_id;
      if v_account_id is null or v_account_id <> v_target_account_id then
        raise exception 'entity_not_found';
      end if;
      if v_current_workspace_id is not null
         and not public.workspace_has_permission(v_current_workspace_id, 'manage_screens') then
        raise exception 'forbidden';
      end if;
      update public.devices set workspace_id = p_workspace_id where id = p_entity_id;

    when 'media' then
      select owner_id, workspace_id into v_account_id, v_current_workspace_id
      from public.media where id = p_entity_id;
      if v_account_id is null or v_account_id <> v_target_account_id then
        raise exception 'entity_not_found';
      end if;
      if v_current_workspace_id is not null
         and not public.workspace_has_permission(v_current_workspace_id, 'manage_content') then
        raise exception 'forbidden';
      end if;
      update public.media set workspace_id = p_workspace_id where id = p_entity_id;

    when 'playlist' then
      select owner_id, workspace_id into v_account_id, v_current_workspace_id
      from public.playlists where id = p_entity_id;
      if v_account_id is null or v_account_id <> v_target_account_id then
        raise exception 'entity_not_found';
      end if;
      if v_current_workspace_id is not null
         and not public.workspace_has_permission(v_current_workspace_id, 'manage_content') then
        raise exception 'forbidden';
      end if;
      update public.playlists set workspace_id = p_workspace_id where id = p_entity_id;

    when 'website' then
      select owner_id, workspace_id into v_account_id, v_current_workspace_id
      from public.websites where id = p_entity_id;
      if v_account_id is null or v_account_id <> v_target_account_id then
        raise exception 'entity_not_found';
      end if;
      if v_current_workspace_id is not null
         and not public.workspace_has_permission(v_current_workspace_id, 'manage_websites') then
        raise exception 'forbidden';
      end if;
      update public.websites set workspace_id = p_workspace_id where id = p_entity_id;

    else
      raise exception 'invalid_entity_type';
  end case;
end;
$$;

revoke all on function public.move_to_workspace(text, uuid, uuid) from public;
grant execute on function public.move_to_workspace(text, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Link device: set workspace_id; allow account members to link to account owner.
-- ---------------------------------------------------------------------------
create or replace function public.link_device_by_pairing_code(
  p_code text,
  p_name text default null,
  p_owner_id uuid default null,
  p_workspace_id uuid default null
)
returns public.devices
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.devices;
  v_owner_id uuid;
  v_workspace_id uuid;
  v_device_count bigint;
  v_limit integer;
begin
  if p_code !~ '^[0-9]{6}$' then
    raise exception 'invalid_pairing_code';
  end if;

  v_owner_id := coalesce(p_owner_id, public.primary_account_id());
  if v_owner_id is null then
    v_owner_id := auth.uid();
  end if;

  if v_owner_id is null then
    raise exception 'not_authenticated';
  end if;

  if public.profile_is_trial_expired(v_owner_id) then
    raise exception 'trial_expired';
  end if;

  if p_owner_id is not null and p_owner_id is distinct from auth.uid() then
    if not public.is_platform_staff_writer()
       and not exists (
         select 1 from public.account_members am
         where am.account_id = p_owner_id and am.user_id = auth.uid()
       ) then
      raise exception 'Forbidden';
    end if;
  elsif v_owner_id is distinct from auth.uid() then
    if not exists (
      select 1 from public.account_members am
      where am.account_id = v_owner_id and am.user_id = auth.uid()
    ) and not public.is_platform_staff_writer() then
      raise exception 'Forbidden';
    end if;
  end if;

  v_workspace_id := p_workspace_id;
  if v_workspace_id is null then
    select w.id into v_workspace_id
    from public.workspaces w
    where w.account_id = v_owner_id and w.is_default
    limit 1;
  end if;

  if v_workspace_id is not null then
    if not exists (
      select 1 from public.workspaces w
      where w.id = v_workspace_id and w.account_id = v_owner_id
    ) then
      raise exception 'invalid_workspace';
    end if;
    if not public.workspace_has_permission(v_workspace_id, 'manage_screens')
       and not public.is_platform_staff_writer()
       and not public.is_account_owner(v_owner_id) then
      raise exception 'forbidden';
    end if;
  end if;

  select p.device_limit into v_limit from public.profiles p where p.id = v_owner_id;
  if v_limit is null then
    raise exception 'owner_not_found';
  end if;

  select count(*) into v_device_count from public.devices d where d.owner_id = v_owner_id;
  if v_device_count >= v_limit then
    raise exception 'device_limit_reached';
  end if;

  update public.devices d
  set
    owner_id = v_owner_id,
    workspace_id = v_workspace_id,
    name = coalesce(nullif(trim(p_name), ''), d.name),
    status = 'offline'
  where d.pairing_code = p_code
    and d.owner_id is null
  returning * into strict result;

  insert into public.device_playback_credentials (device_id, secret)
  values (result.id, lower(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')))
  on conflict (device_id) do update set secret = excluded.secret;

  return result;
exception
  when no_data_found then
    raise exception 'device_not_found_or_already_linked';
end;
$$;

revoke all on function public.link_device_by_pairing_code(text, text, uuid, uuid) from public;
grant execute on function public.link_device_by_pairing_code(text, text, uuid, uuid) to authenticated;
