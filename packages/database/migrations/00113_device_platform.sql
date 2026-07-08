-- Distinguish Android TV screens from browser-based players.

alter table public.devices
  add column if not exists platform text not null default 'android';

alter table public.devices
  drop constraint if exists devices_platform_check;

alter table public.devices
  add constraint devices_platform_check check (platform in ('android', 'browser'));

comment on column public.devices.platform is
  'Screen client type: android (TV APK) or browser (player.onesigntv.com).';

-- Infer platform from browser-prefixed client ids when p_platform is omitted.
create or replace function public.infer_device_platform(
  p_android_id text,
  p_platform text default null
)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when nullif(trim(p_platform), '') in ('android', 'browser')
      then nullif(trim(p_platform), '')
    when nullif(trim(p_android_id), '') like 'browser:%'
      then 'browser'
    else 'android'
  end;
$$;

drop function if exists public.register_or_restore_device(text, text);

create or replace function public.register_or_restore_device(
  p_android_id text,
  p_timezone text default null,
  p_platform text default null
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
  v_platform     text := public.infer_device_platform(p_android_id, p_platform);
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
            platform = v_platform,
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
        'playback_disabled', v_device.playback_disabled,
        'platform', v_device.platform
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
    operating_hours_timezone,
    platform
  )
  values (
    v_android_id,
    v_session_id,
    v_pairing_code,
    'pending_pairing',
    coalesce(v_tz, 'UTC'),
    v_platform
  )
  returning * into v_device;

  return json_build_object(
    'device_id', v_device.id,
    'is_new', true,
    'status', v_device.status,
    'pairing_code', v_device.pairing_code,
    'owner_id', null,
    'playback_disabled', false,
    'platform', v_device.platform
  );
end;
$$;

grant execute on function public.register_or_restore_device(text, text, text) to authenticated;
