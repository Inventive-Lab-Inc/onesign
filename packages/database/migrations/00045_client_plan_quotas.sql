-- Plan quotas: storage limits, device quota enforcement (pause excess screens).

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

alter table public.media
  add column if not exists size_bytes bigint not null default 0;

alter table public.media
  drop constraint if exists media_size_bytes_non_negative;

alter table public.media
  add constraint media_size_bytes_non_negative check (size_bytes >= 0);

comment on column public.media.size_bytes is
  'Object size in bytes at upload time; used for per-client storage quotas.';

alter table public.profiles
  add column if not exists storage_limit_bytes bigint not null default 2147483648;

alter table public.profiles
  drop constraint if exists profiles_storage_limit_positive;

alter table public.profiles
  add constraint profiles_storage_limit_positive check (storage_limit_bytes >= 1048576);

comment on column public.profiles.storage_limit_bytes is
  'Maximum cloud library storage for this client (bytes). Default 2 GiB.';

alter table public.devices
  add column if not exists paused_by_quota boolean not null default false;

comment on column public.devices.paused_by_quota is
  'When true, playback was paused because the client exceeded their screen plan limit.';

-- Backfill storage limits: at least 2 GiB or current tracked usage.
update public.profiles p
set storage_limit_bytes = greatest(
  2147483648::bigint,
  coalesce((
    select sum(m.size_bytes)::bigint
    from public.media m
    where m.owner_id = p.id
  ), 0)
);

-- ---------------------------------------------------------------------------
-- Storage helpers
-- ---------------------------------------------------------------------------

create or replace function public.get_owner_storage_used(p_owner_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(m.size_bytes), 0)::bigint
  from public.media m
  where m.owner_id = p_owner_id;
$$;

revoke all on function public.get_owner_storage_used(uuid) from public;
grant execute on function public.get_owner_storage_used(uuid) to authenticated;

create or replace function public.check_storage_quota(p_owner_id uuid, p_add_bytes bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit bigint;
  v_used bigint;
begin
  if p_owner_id is null then
    raise exception 'Missing owner id';
  end if;

  if p_add_bytes is null or p_add_bytes < 0 then
    raise exception 'invalid_file_size';
  end if;

  select p.storage_limit_bytes
  into v_limit
  from public.profiles p
  where p.id = p_owner_id;

  if v_limit is null then
    raise exception 'owner_not_found';
  end if;

  v_used := public.get_owner_storage_used(p_owner_id);

  if v_used + p_add_bytes > v_limit then
    raise exception 'storage_limit_reached';
  end if;
end;
$$;

revoke all on function public.check_storage_quota(uuid, bigint) from public;
grant execute on function public.check_storage_quota(uuid, bigint) to authenticated;

create or replace function public.enforce_profile_storage_limit_admin_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.storage_limit_bytes is distinct from old.storage_limit_bytes
     and not public.is_platform_staff_writer() then
    raise exception 'Only platform staff can change storage limits'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_storage_limit_admin_only on public.profiles;
create trigger profiles_storage_limit_admin_only
  before update of storage_limit_bytes on public.profiles
  for each row
  execute function public.enforce_profile_storage_limit_admin_only();

create or replace function public.admin_set_storage_limit(p_user_id uuid, p_limit_bytes bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_staff_writer() then
    raise exception 'Forbidden';
  end if;

  if p_user_id is null then
    raise exception 'Missing user id';
  end if;

  if p_limit_bytes is null or p_limit_bytes < 1048576 then
    raise exception 'invalid_storage_limit';
  end if;

  update public.profiles
  set storage_limit_bytes = p_limit_bytes
  where id = p_user_id;

  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

revoke all on function public.admin_set_storage_limit(uuid, bigint) from public;
grant execute on function public.admin_set_storage_limit(uuid, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- Device quota: pause screens that exceed the plan
-- ---------------------------------------------------------------------------

drop function if exists public.admin_set_device_limit(uuid, integer);

create or replace function public.apply_device_quota(
  p_user_id uuid,
  p_limit integer,
  p_active_device_ids uuid[] default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active uuid[];
begin
  if p_user_id is null then
    raise exception 'Missing user id';
  end if;

  if p_limit is null or p_limit < 1 then
    raise exception 'invalid_device_limit';
  end if;

  perform set_config('onesign.quota_apply', 'true', true);

  if p_active_device_ids is not null and coalesce(array_length(p_active_device_ids, 1), 0) > 0 then
    if array_length(p_active_device_ids, 1) > p_limit then
      raise exception 'too_many_active_devices';
    end if;

    if exists (
      select 1
      from unnest(p_active_device_ids) as picked(device_id)
      where not exists (
        select 1
        from public.devices d
        where d.id = picked.device_id
          and d.owner_id = p_user_id
      )
    ) then
      raise exception 'invalid_device_ids';
    end if;

    v_active := p_active_device_ids;
  else
    select coalesce(array_agg(sub.id), array[]::uuid[])
    into v_active
    from (
      select d.id
      from public.devices d
      where d.owner_id = p_user_id
      order by d.last_seen desc nulls last, d.created_at asc
      limit p_limit
    ) sub;
  end if;

  update public.devices d
  set
    paused_by_quota = true,
    playback_disabled = true
  where d.owner_id = p_user_id
    and not (d.id = any(v_active));

  update public.devices d
  set
    paused_by_quota = false,
    playback_disabled = false
  where d.owner_id = p_user_id
    and d.id = any(v_active)
    and d.paused_by_quota = true;
end;
$$;

revoke all on function public.apply_device_quota(uuid, integer, uuid[]) from public;
grant execute on function public.apply_device_quota(uuid, integer, uuid[]) to authenticated;

create or replace function public.admin_set_device_limit(
  p_user_id uuid,
  p_limit integer,
  p_active_device_ids uuid[] default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_staff_writer() then
    raise exception 'Forbidden';
  end if;

  if p_user_id is null then
    raise exception 'Missing user id';
  end if;

  if p_limit is null or p_limit < 1 then
    raise exception 'invalid_device_limit';
  end if;

  update public.profiles
  set device_limit = p_limit
  where id = p_user_id;

  if not found then
    raise exception 'User not found';
  end if;

  perform public.apply_device_quota(p_user_id, p_limit, p_active_device_ids);
end;
$$;

revoke all on function public.admin_set_device_limit(uuid, integer, uuid[]) from public;
grant execute on function public.admin_set_device_limit(uuid, integer, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin directory RPCs (include storage)
-- ---------------------------------------------------------------------------

drop function if exists public.admin_get_client(uuid);

create or replace function public.admin_get_client(p_user_id uuid)
returns table (
  id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  device_count bigint,
  online_device_count bigint,
  active_device_count bigint,
  device_limit integer,
  storage_used_bytes bigint,
  storage_limit_bytes bigint,
  is_disabled boolean,
  is_staff boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_platform_staff() then
    raise exception 'Forbidden';
  end if;

  if p_user_id is null then
    raise exception 'Missing user id';
  end if;

  return query
  select
    p.id,
    u.email::text,
    p.full_name,
    p.created_at,
    count(d.id) as device_count,
    count(d.id) filter (where d.status = 'online') as online_device_count,
    count(d.id) filter (where not d.paused_by_quota and not d.playback_disabled) as active_device_count,
    p.device_limit,
    public.get_owner_storage_used(p.id) as storage_used_bytes,
    p.storage_limit_bytes,
    p.is_disabled,
    exists (
      select 1
      from public.platform_staff s
      where s.user_id = p.id
        and s.is_active
    ) as is_staff
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.devices d on d.owner_id = p.id
  where p.id = p_user_id
    and u.is_anonymous = false
    and u.email is not null
  group by p.id, u.email, p.full_name, p.created_at, p.device_limit, p.storage_limit_bytes, p.is_disabled;
end;
$$;

revoke all on function public.admin_get_client(uuid) from public;
grant execute on function public.admin_get_client(uuid) to authenticated;

drop function if exists public.admin_list_users();

create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  device_count bigint,
  online_device_count bigint,
  active_device_count bigint,
  device_limit integer,
  storage_used_bytes bigint,
  storage_limit_bytes bigint,
  is_disabled boolean,
  is_staff boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_platform_staff() then
    raise exception 'Forbidden';
  end if;

  return query
  select
    p.id,
    u.email::text,
    p.full_name,
    p.created_at,
    count(d.id) as device_count,
    count(d.id) filter (where d.status = 'online') as online_device_count,
    count(d.id) filter (where not d.paused_by_quota and not d.playback_disabled) as active_device_count,
    p.device_limit,
    public.get_owner_storage_used(p.id) as storage_used_bytes,
    p.storage_limit_bytes,
    p.is_disabled,
    exists (
      select 1
      from public.platform_staff s
      where s.user_id = p.id
        and s.is_active
    ) as is_staff
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.devices d on d.owner_id = p.id
  where u.is_anonymous = false
    and u.email is not null
  group by p.id, u.email, p.full_name, p.created_at, p.device_limit, p.storage_limit_bytes, p.is_disabled
  order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

-- Reconcile device quota for all clients (no-op when count <= limit).
do $$
declare
  r record;
begin
  for r in select p.id, p.device_limit from public.profiles p loop
    perform public.apply_device_quota(r.id, r.device_limit, null);
  end loop;
end;
$$;
