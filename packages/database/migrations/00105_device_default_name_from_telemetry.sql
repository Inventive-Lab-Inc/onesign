-- When linking a screen without a display name, derive one from TV telemetry
-- (manufacturer/brand + model), e.g. "vivo - XT123".

create or replace function public.device_default_name_from_telemetry(p_telemetry jsonb)
returns text
language sql
immutable
as $$
  with hw as (
    select
      nullif(trim(coalesce(p_telemetry->'hardware'->>'brand', p_telemetry->'hardware'->>'manufacturer')), '') as brand,
      nullif(trim(p_telemetry->'hardware'->>'model'), '') as model
  )
  select case
    when brand is not null and model is not null then brand || ' - ' || model
    else coalesce(brand, model)
  end
  from hw;
$$;

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
    name = coalesce(
      nullif(trim(p_name), ''),
      public.device_default_name_from_telemetry(d.telemetry),
      d.name
    ),
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
