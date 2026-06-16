-- Screen timezone: auto-detect from the TV (APK) at registration and via telemetry.
-- Admin can lock the timezone by saving operating hours in the dashboard.

alter table public.devices
  add column if not exists operating_hours_timezone_auto boolean not null default true;

comment on column public.devices.operating_hours_timezone_auto is
  'When true, operating_hours_timezone is synced from TV telemetry/registration. Set false when admin saves Hours.';

create or replace function public.normalize_iana_timezone(p_timezone text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(trim(p_timezone), '');
$$;

create or replace function public.apply_device_timezone_from_tv(
  p_device_id uuid,
  p_timezone text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text := public.normalize_iana_timezone(p_timezone);
begin
  if v_tz is null then
    return;
  end if;

  update public.devices d
  set operating_hours_timezone = v_tz
  where d.id = p_device_id
    and d.operating_hours_timezone_auto = true;
end;
$$;

-- Pairing / reinstall: capture timezone from the APK immediately.
drop function if exists public.register_or_restore_device(text);

create or replace function public.register_or_restore_device(
  p_android_id text,
  p_timezone text default null
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_device       public.devices%rowtype;
  v_session_id   uuid := auth.uid();
  v_android_id   text := nullif(trim(p_android_id), '');
  v_pairing_code text;
  v_tz           text := public.normalize_iana_timezone(p_timezone);
begin
  if v_session_id is null then
    raise exception 'unauthenticated';
  end if;

  if v_android_id is not null then
    select * into v_device
    from public.devices
    where android_id = v_android_id
    order by (owner_id is not null) desc, last_seen desc nulls last, created_at desc
    limit 1;

    if found then
      update public.devices
        set registered_session_id = v_session_id,
            last_seen = now(),
            operating_hours_timezone = case
              when operating_hours_timezone_auto and v_tz is not null then v_tz
              else operating_hours_timezone
            end
      where id = v_device.id
      returning * into v_device;

      return json_build_object(
        'device_id', v_device.id,
        'is_new', false,
        'status', v_device.status,
        'pairing_code', v_device.pairing_code,
        'owner_id', v_device.owner_id,
        'playback_disabled', v_device.playback_disabled
      );
    end if;
  end if;

  loop
    v_pairing_code := lpad(floor(random() * 1000000)::text, 6, '0');
    exit when not exists (
      select 1 from public.devices where pairing_code = v_pairing_code
    );
  end loop;

  insert into public.devices (
    android_id,
    registered_session_id,
    pairing_code,
    status,
    operating_hours_timezone
  )
  values (
    v_android_id,
    v_session_id,
    v_pairing_code,
    'pending_pairing',
    coalesce(v_tz, 'UTC')
  )
  returning * into v_device;

  return json_build_object(
    'device_id', v_device.id,
    'is_new', true,
    'status', v_device.status,
    'pairing_code', v_device.pairing_code,
    'owner_id', null,
    'playback_disabled', false
  );
end;
$$;

grant execute on function public.register_or_restore_device(text, text) to authenticated;

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

  v_tz := public.normalize_iana_timezone(p_telemetry ->> 'timezone');

  update public.devices d
  set
    telemetry = coalesce(d.telemetry, '{}'::jsonb) || coalesce(p_telemetry, '{}'::jsonb),
    telemetry_at = now(),
    last_seen = now(),
    status = 'online',
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

revoke all on function public.tv_device_report_telemetry(uuid, jsonb, text) from public;
grant execute on function public.tv_device_report_telemetry(uuid, jsonb, text) to anon, authenticated;
