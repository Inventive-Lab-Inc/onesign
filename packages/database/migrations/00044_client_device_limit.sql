-- Per-client screen allocation: admins set how many devices a client may link.

alter table public.profiles
  add column if not exists device_limit integer not null default 1;

alter table public.profiles
  drop constraint if exists profiles_device_limit_positive;

alter table public.profiles
  add constraint profiles_device_limit_positive check (device_limit >= 1);

comment on column public.profiles.device_limit is
  'Maximum linked devices this client may claim via pairing.';

-- Existing clients: limit = current linked device count (minimum 1).
update public.profiles p
set device_limit = greatest(
  1,
  coalesce((
    select count(*)::integer
    from public.devices d
    where d.owner_id = p.id
  ), 0)
);

create or replace function public.enforce_profile_device_limit_admin_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.device_limit is distinct from old.device_limit
     and not public.is_platform_staff_writer() then
    raise exception 'Only platform staff can change device limits'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_device_limit_admin_only on public.profiles;
create trigger profiles_device_limit_admin_only
  before update of device_limit on public.profiles
  for each row
  execute function public.enforce_profile_device_limit_admin_only();

drop function if exists public.link_device_by_pairing_code(text, text);

create or replace function public.link_device_by_pairing_code(
  p_code text,
  p_name text default null,
  p_owner_id uuid default null
)
returns public.devices
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.devices;
  v_owner_id uuid;
  v_device_count bigint;
  v_limit integer;
begin
  if p_code !~ '^[0-9]{6}$' then
    raise exception 'invalid_pairing_code';
  end if;

  v_owner_id := coalesce(p_owner_id, auth.uid());
  if v_owner_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_owner_id is not null and p_owner_id is distinct from auth.uid() then
    if not public.is_platform_staff_writer() then
      raise exception 'Forbidden';
    end if;
  end if;

  select p.device_limit
  into v_limit
  from public.profiles p
  where p.id = v_owner_id;

  if v_limit is null then
    raise exception 'owner_not_found';
  end if;

  select count(*)
  into v_device_count
  from public.devices d
  where d.owner_id = v_owner_id;

  if v_device_count >= v_limit then
    raise exception 'device_limit_reached';
  end if;

  update public.devices d
  set
    owner_id = v_owner_id,
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

revoke all on function public.link_device_by_pairing_code(text, text, uuid) from public;
grant execute on function public.link_device_by_pairing_code(text, text, uuid) to authenticated;

create or replace function public.admin_set_device_limit(p_user_id uuid, p_limit integer)
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
end;
$$;

revoke all on function public.admin_set_device_limit(uuid, integer) from public;
grant execute on function public.admin_set_device_limit(uuid, integer) to authenticated;

drop function if exists public.admin_get_client(uuid);

create or replace function public.admin_get_client(p_user_id uuid)
returns table (
  id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  device_count bigint,
  online_device_count bigint,
  device_limit integer,
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
    p.device_limit,
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
  group by p.id, u.email, p.full_name, p.created_at, p.device_limit, p.is_disabled;
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
  device_limit integer,
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
    p.device_limit,
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
  group by p.id, u.email, p.full_name, p.created_at, p.device_limit, p.is_disabled
  order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;
