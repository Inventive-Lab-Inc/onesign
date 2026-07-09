-- Backfill generic screen names from hardware telemetry when TVs report it after link,
-- and apply the same rule when reconnecting a player to an existing screen.

create or replace function public.tv_device_report_telemetry(
  p_device_id uuid,
  p_telemetry jsonb,
  p_playback_secret text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg uuid;
  v_secret text;
  v_ok_secret boolean := false;
  v_tz text;
  v_merged_telemetry jsonb;
begin
  if not exists (select 1 from public.devices d where d.id = p_device_id) then
    return;
  end if;

  select d.registered_session_id
  into v_reg
  from public.devices d
  where d.id = p_device_id;

  select c.secret
  into v_secret
  from public.device_playback_credentials c
  where c.device_id = p_device_id;

  if p_playback_secret is not null
     and trim(p_playback_secret) <> ''
     and v_secret is not null
     and trim(v_secret) <> ''
     and v_secret = p_playback_secret then
    v_ok_secret := true;
  end if;

  if not v_ok_secret then
    if auth.uid() is null then
      return;
    end if;
    if v_reg is null or v_reg is distinct from auth.uid() then
      return;
    end if;
  end if;

  select coalesce(d.telemetry, '{}'::jsonb) || coalesce(p_telemetry, '{}'::jsonb)
  into v_merged_telemetry
  from public.devices d
  where d.id = p_device_id;

  v_tz := public.normalize_iana_timezone(p_telemetry ->> 'timezone');

  update public.devices d
  set
    telemetry = v_merged_telemetry,
    telemetry_at = now(),
    last_seen = now(),
    status = 'online',
    name = case
      when nullif(trim(d.name), '') is null or trim(d.name) = 'TV Device' then
        coalesce(public.device_default_name_from_telemetry(v_merged_telemetry), d.name)
      else d.name
    end,
    operating_hours_timezone = case
      when d.operating_hours_timezone_auto and v_tz is not null then v_tz
      else d.operating_hours_timezone
    end
  where d.id = p_device_id
    and (
      v_ok_secret
      or (
        auth.uid() is not null
        and d.registered_session_id is not distinct from auth.uid()
      )
    );
end;
$$;

create or replace function public.rebind_device_by_pairing_code(
  p_device_id uuid,
  p_code text,
  p_owner_id uuid default null
)
returns public.devices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.devices;
  v_pending public.devices;
  v_owner_id uuid;
  v_saved_android_id text;
  v_saved_registered_session_id uuid;
  v_saved_platform text;
  v_saved_telemetry jsonb;
  v_saved_telemetry_at timestamptz;
  v_saved_pairing_code text;
  v_merged_telemetry jsonb;
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

  select * into strict v_target
  from public.devices d
  where d.id = p_device_id
    and d.owner_id = v_owner_id;

  if v_target.workspace_id is not null then
    if not public.workspace_has_permission(v_target.workspace_id, 'manage_screens')
       and not public.is_platform_staff_writer()
       and not public.is_account_owner(v_owner_id) then
      raise exception 'forbidden';
    end if;
  end if;

  select * into strict v_pending
  from public.devices d
  where d.pairing_code = p_code
    and d.owner_id is null;

  if v_pending.id = v_target.id then
    raise exception 'device_not_found_or_already_linked';
  end if;

  v_saved_android_id := v_pending.android_id;
  v_saved_registered_session_id := v_pending.registered_session_id;
  v_saved_platform := v_pending.platform;
  v_saved_telemetry := v_pending.telemetry;
  v_saved_telemetry_at := v_pending.telemetry_at;
  v_saved_pairing_code := v_pending.pairing_code;
  v_merged_telemetry := coalesce(v_saved_telemetry, v_target.telemetry, '{}'::jsonb);

  delete from public.devices where id = v_pending.id;

  update public.devices
  set
    android_id = v_saved_android_id,
    registered_session_id = v_saved_registered_session_id,
    platform = v_saved_platform,
    telemetry = v_merged_telemetry,
    telemetry_at = coalesce(v_saved_telemetry_at, telemetry_at),
    pairing_code = v_saved_pairing_code,
    name = case
      when nullif(trim(v_target.name), '') is null or trim(v_target.name) = 'TV Device' then
        coalesce(public.device_default_name_from_telemetry(v_merged_telemetry), v_target.name)
      else v_target.name
    end,
    status = 'offline',
    last_seen = now()
  where id = v_target.id
  returning * into strict v_target;

  insert into public.device_playback_credentials (device_id, secret)
  values (v_target.id, lower(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')))
  on conflict (device_id) do update set secret = excluded.secret;

  return v_target;
exception
  when no_data_found then
    raise exception 'device_not_found_or_already_linked';
end;
$$;
