-- Short, URL-facing public code for screens (e.g. /screens/7Kf3pQ2m).
-- The UUID `devices.id` stays the internal identity (FKs, TV RPCs, realtime,
-- storage paths). `public_code` is an additional, opaque, non-enumerable handle
-- used only in dashboard URLs. Generated via a column default so every insert
-- path (incl. register_or_restore_device) populates it without code changes.

-- 8-char base62 code. Space is 62^8 ≈ 2.18e14, so collisions are negligible at
-- fleet scale; the unique index below is the hard guarantee.
create or replace function public.gen_device_public_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_alphabet constant text :=
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  v_code text := '';
  i int;
begin
  for i in 1..8 loop
    v_code := v_code || substr(v_alphabet, floor(random() * 62)::int + 1, 1);
  end loop;
  return v_code;
end;
$$;

-- Returns a code guaranteed not to collide with existing rows (used for backfill).
create or replace function public.gen_unique_device_public_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_code text;
begin
  loop
    v_code := public.gen_device_public_code();
    exit when not exists (
      select 1 from public.devices where public_code = v_code
    );
  end loop;
  return v_code;
end;
$$;

alter table public.devices
  add column if not exists public_code text;

-- Backfill existing rows one at a time so generated codes stay unique within
-- the transaction (later iterations see earlier updates).
do $$
declare
  r record;
begin
  for r in select id from public.devices where public_code is null loop
    update public.devices
      set public_code = public.gen_unique_device_public_code()
      where id = r.id;
  end loop;
end $$;

create unique index if not exists devices_public_code_key
  on public.devices (public_code);

alter table public.devices
  alter column public_code set default public.gen_device_public_code();

alter table public.devices
  alter column public_code set not null;

comment on column public.devices.public_code is
  'Short opaque base62 code used in dashboard URLs (/screens/{public_code}). '
  'Not the primary key; devices.id (uuid) remains the internal identity.';
