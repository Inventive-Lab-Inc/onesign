-- AbleSign-style screen operating hours and per-playlist-item daily display windows.

alter table public.devices
  add column if not exists operating_hours jsonb not null default '{
    "monday": {"start": "00:00", "end": "23:59"},
    "tuesday": {"start": "00:00", "end": "23:59"},
    "wednesday": {"start": "00:00", "end": "23:59"},
    "thursday": {"start": "00:00", "end": "23:59"},
    "friday": {"start": "00:00", "end": "23:59"},
    "saturday": {"start": "00:00", "end": "23:59"},
    "sunday": {"start": "00:00", "end": "23:59"}
  }'::jsonb,
  add column if not exists operating_hours_timezone text not null default 'UTC',
  add column if not exists blank_when_off_hours boolean not null default false;

alter table public.playlist_items
  add column if not exists daily_schedule_enabled boolean not null default false,
  add column if not exists daily_schedule jsonb;

comment on column public.devices.operating_hours is
  'Weekly local-time windows when this screen is in use (Mon–Sun start/end HH:MM).';
comment on column public.devices.operating_hours_timezone is
  'IANA timezone for operating hours and item daily schedules on this screen.';
comment on column public.devices.blank_when_off_hours is
  'When true, TV shows a blank screen outside operating hours instead of playlist content.';
comment on column public.playlist_items.daily_schedule_enabled is
  'When true, item only plays during daily_schedule windows (screen timezone).';
comment on column public.playlist_items.daily_schedule is
  'Weekly local-time windows for this playlist item (Mon–Sun start/end HH:MM).';

create or replace function public.time_hhmm_is_within(
  p_local_time time,
  p_start_hhmm text,
  p_end_hhmm text
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_start time;
  v_end time;
begin
  if p_start_hhmm is null or trim(p_start_hhmm) = '' or p_end_hhmm is null or trim(p_end_hhmm) = '' then
    return true;
  end if;
  v_start := p_start_hhmm::time;
  v_end := p_end_hhmm::time;
  if v_start <= v_end then
    return p_local_time >= v_start and p_local_time <= v_end;
  end if;
  return p_local_time >= v_start or p_local_time <= v_end;
end;
$$;

create or replace function public.weekly_schedule_is_active_now(
  p_schedule jsonb,
  p_timezone text,
  p_at timestamptz default now()
)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v_local timestamp;
  v_dow integer;
  v_day_key text;
  v_day jsonb;
begin
  if p_schedule is null then
    return true;
  end if;
  v_local := timezone(coalesce(nullif(trim(p_timezone), ''), 'UTC'), p_at);
  v_dow := extract(dow from v_local)::integer;
  v_day_key := case v_dow
    when 0 then 'sunday'
    when 1 then 'monday'
    when 2 then 'tuesday'
    when 3 then 'wednesday'
    when 4 then 'thursday'
    when 5 then 'friday'
    when 6 then 'saturday'
    else 'monday'
  end;
  v_day := p_schedule -> v_day_key;
  if v_day is null then
    return true;
  end if;
  return public.time_hhmm_is_within(v_local::time, v_day ->> 'start', v_day ->> 'end');
end;
$$;

create or replace function public.device_is_in_operating_hours(
  p_operating_hours jsonb,
  p_timezone text,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
set search_path = public
as $$
  select public.weekly_schedule_is_active_now(p_operating_hours, p_timezone, p_at);
$$;

create or replace function public.playlist_item_is_active_for_playback(
  p_display_from timestamptz,
  p_display_until timestamptz,
  p_daily_enabled boolean,
  p_daily_schedule jsonb,
  p_asset_display_from timestamptz,
  p_asset_display_until timestamptz,
  p_timezone text,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
set search_path = public
as $$
  select public.playback_schedule_is_active(p_display_from, p_display_until, p_at)
     and public.playback_schedule_is_active(p_asset_display_from, p_asset_display_until, p_at)
     and (
       not coalesce(p_daily_enabled, false)
       or public.weekly_schedule_is_active_now(p_daily_schedule, p_timezone, p_at)
     );
$$;

-- Wake TVs when operating hours or item daily schedule changes.
create or replace function public.bump_device_playlists_on_device_hours_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' then
    if (
      old.operating_hours is distinct from new.operating_hours
      or old.operating_hours_timezone is distinct from new.operating_hours_timezone
      or old.blank_when_off_hours is distinct from new.blank_when_off_hours
    ) then
      update public.device_playlists dp
      set updated_at = now()
      where dp.device_id = new.id
        and dp.is_active = true;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists devices_bump_playlists_on_hours on public.devices;
create trigger devices_bump_playlists_on_hours
  after update of operating_hours, operating_hours_timezone, blank_when_off_hours on public.devices
  for each row execute function public.bump_device_playlists_on_device_hours_change();

create or replace function public.bump_device_playlists_on_playlist_item_schedule_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' then
    if (
      old.daily_schedule_enabled is distinct from new.daily_schedule_enabled
      or old.daily_schedule is distinct from new.daily_schedule
      or old.display_from is distinct from new.display_from
      or old.display_until is distinct from new.display_until
      or old.duration_seconds is distinct from new.duration_seconds
      or old.sort_order is distinct from new.sort_order
    ) then
      update public.device_playlists dp
      set updated_at = now()
      where dp.playlist_id = new.playlist_id
        and dp.is_active = true;
    end if;
  elsif TG_OP = 'INSERT' or TG_OP = 'DELETE' then
    update public.device_playlists dp
    set updated_at = now()
    where dp.playlist_id = coalesce(new.playlist_id, old.playlist_id)
      and dp.is_active = true;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists playlist_items_bump_playlists_on_schedule on public.playlist_items;
create trigger playlist_items_bump_playlists_on_schedule
  after insert or update or delete on public.playlist_items
  for each row execute function public.bump_device_playlists_on_playlist_item_schedule_change();
