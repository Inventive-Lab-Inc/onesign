-- Auto-reconnect a TV after an uninstall/reinstall by detecting the hardware
-- (Settings.Secure.ANDROID_ID), instead of minting a brand-new device + pairing
-- code every fresh install.
--
-- Background: the TV's local DataStore (device_id, pairing_code, playback_secret)
-- is wiped on uninstall, and `android:allowBackup` is false, so nothing local
-- survives. The stable signal that *does* survive is ANDROID_ID. We persist it on
-- `devices.android_id` and resolve identity server-side via
-- `register_or_restore_device`, so a previously linked screen comes straight back
-- to playback with no pairing prompt.
--
-- This migration also formalizes objects that were previously applied directly to
-- the database (out of migration tracking): the `devices.android_id` column and an
-- earlier `register_or_restore_device`. It is written to be idempotent.

-- ---------------------------------------------------------------------------
-- 1. Stable hardware id column
-- ---------------------------------------------------------------------------
alter table public.devices
  add column if not exists android_id text;

-- ---------------------------------------------------------------------------
-- 2. Backfill from telemetry, collapsing duplicates created before this feature.
--
-- The TV already reported ANDROID_ID inside telemetry (`settings_android_id`),
-- so one physical device often has several rows (one per reinstall). Pick a single
-- winner per hardware id and stamp it; prefer a linked row, then most recently seen.
-- ---------------------------------------------------------------------------
with ranked as (
  select
    id,
    nullif(trim(telemetry ->> 'settings_android_id'), '') as tel_android_id,
    row_number() over (
      partition by nullif(trim(telemetry ->> 'settings_android_id'), '')
      order by (owner_id is not null) desc, last_seen desc nulls last, created_at desc
    ) as rn
  from public.devices
  where nullif(trim(telemetry ->> 'settings_android_id'), '') is not null
)
update public.devices d
set android_id = r.tel_android_id
from ranked r
where d.id = r.id
  and r.rn = 1
  and d.android_id is null;

-- ---------------------------------------------------------------------------
-- 3. Remove the leftover unlinked duplicates (the junk rows from repeated
-- reinstalls). Linked rows are never deleted. Child rows cascade.
-- ---------------------------------------------------------------------------
with ranked as (
  select
    id,
    owner_id,
    row_number() over (
      partition by nullif(trim(telemetry ->> 'settings_android_id'), '')
      order by (owner_id is not null) desc, last_seen desc nulls last, created_at desc
    ) as rn
  from public.devices
  where nullif(trim(telemetry ->> 'settings_android_id'), '') is not null
)
delete from public.devices d
using ranked r
where d.id = r.id
  and r.rn > 1
  and r.owner_id is null;

-- ---------------------------------------------------------------------------
-- 4. One device row per hardware id going forward. A plain UNIQUE constraint
-- still allows many rows with a NULL android_id (devices that never reported one),
-- while rejecting duplicate non-NULL ids.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'devices_android_id_key'
      and conrelid = 'public.devices'::regclass
  ) then
    alter table public.devices
      add constraint devices_android_id_key unique (android_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Identity resolver called by the TV on every fresh registration.
--
-- Matches an existing device by android_id and rebinds the (new, anonymous)
-- session to it — returning the existing owner + pairing code so a linked screen
-- skips pairing. Falls back to creating a fresh, unique pairing code otherwise.
-- SECURITY DEFINER so it can read/rebind a row this anonymous session cannot yet
-- see under RLS; it always re-stamps registered_session_id = auth.uid() so the
-- subsequent RLS-scoped reads (and tv_get_playback_*) authorize this session.
-- ---------------------------------------------------------------------------
create or replace function public.register_or_restore_device(p_android_id text)
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
begin
  if v_session_id is null then
    raise exception 'unauthenticated';
  end if;

  -- Known hardware: restore the existing screen and rebind this session.
  if v_android_id is not null then
    select * into v_device
    from public.devices
    where android_id = v_android_id
    order by (owner_id is not null) desc, last_seen desc nulls last, created_at desc
    limit 1;

    if found then
      update public.devices
        set registered_session_id = v_session_id,
            last_seen = now()
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

  -- New hardware (or no usable android id): mint a globally-unique pairing code.
  loop
    v_pairing_code := lpad(floor(random() * 1000000)::text, 6, '0');
    exit when not exists (
      select 1 from public.devices where pairing_code = v_pairing_code
    );
  end loop;

  insert into public.devices (android_id, registered_session_id, pairing_code, status)
  values (v_android_id, v_session_id, v_pairing_code, 'pending_pairing')
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

grant execute on function public.register_or_restore_device(text) to authenticated;
