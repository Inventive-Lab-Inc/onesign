-- Rename profiles.full_name → client_name for consistent client/account naming.

alter table public.profiles rename column full_name to client_name;

comment on column public.profiles.client_name is
  'Client or account holder name from signup (first + last) or Google sign-in.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, client_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', null))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop function if exists public.admin_get_client(uuid);

create or replace function public.admin_get_client(p_user_id uuid)
returns table (
  id uuid,
  email text,
  client_name text,
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
    p.client_name,
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
  group by p.id, u.email, p.client_name, p.created_at, p.device_limit, p.storage_limit_bytes, p.is_disabled;
end;
$$;

revoke all on function public.admin_get_client(uuid) from public;
grant execute on function public.admin_get_client(uuid) to authenticated;

drop function if exists public.admin_list_users();

create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  client_name text,
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
    p.client_name,
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
  group by p.id, u.email, p.client_name, p.created_at, p.device_limit, p.storage_limit_bytes, p.is_disabled
  order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;
