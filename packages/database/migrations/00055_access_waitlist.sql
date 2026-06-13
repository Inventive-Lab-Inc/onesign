-- Public access waitlist: login "Apply" submissions visible to platform staff.

create table if not exists public.access_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  company_name text,
  screen_count integer,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'reviewed', 'invited', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null
);

create index if not exists access_waitlist_status_created_idx
  on public.access_waitlist (status, created_at desc);

create index if not exists access_waitlist_email_lower_idx
  on public.access_waitlist (lower(email));

create unique index if not exists access_waitlist_pending_email_key
  on public.access_waitlist (lower(email))
  where status = 'pending';

alter table public.access_waitlist enable row level security;

drop policy if exists access_waitlist_select_staff on public.access_waitlist;
create policy access_waitlist_select_staff on public.access_waitlist
  for select using (public.is_platform_staff());

comment on table public.access_waitlist is
  'Login-page access requests; staff review and invite from admin.';

create or replace function public.admin_list_waitlist(
  p_limit integer default 50,
  p_offset integer default 0,
  p_status text default 'pending'
)
returns table (
  id uuid,
  email text,
  company_name text,
  screen_count integer,
  message text,
  status text,
  created_at timestamptz,
  reviewed_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_limit integer := greatest(coalesce(p_limit, 50), 1);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_status text := lower(coalesce(nullif(trim(p_status), ''), 'pending'));
begin
  if not public.is_platform_staff() then
    raise exception 'Forbidden';
  end if;

  if v_status not in ('all', 'pending', 'reviewed', 'invited', 'dismissed') then
    raise exception 'invalid_status_filter';
  end if;

  if v_limit > 200 then
    v_limit := 200;
  end if;

  return query
  with filtered as (
    select
      w.id,
      w.email,
      w.company_name,
      w.screen_count,
      w.message,
      w.status,
      w.created_at,
      w.reviewed_at
    from public.access_waitlist w
    where v_status = 'all' or w.status = v_status
  )
  select
    f.id,
    f.email,
    f.company_name,
    f.screen_count,
    f.message,
    f.status,
    f.created_at,
    f.reviewed_at,
    count(*) over() as total_count
  from filtered f
  order by f.created_at desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.admin_list_waitlist(integer, integer, text) from public;
grant execute on function public.admin_list_waitlist(integer, integer, text) to authenticated;

create or replace function public.admin_update_waitlist_status(
  p_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_status text := lower(trim(coalesce(p_status, '')));
begin
  if not public.is_platform_staff_writer() then
    raise exception 'Forbidden';
  end if;

  if v_status not in ('pending', 'reviewed', 'invited', 'dismissed') then
    raise exception 'invalid_status';
  end if;

  update public.access_waitlist
  set
    status = v_status,
    reviewed_at = case when v_status = 'pending' then null else now() end,
    reviewed_by = case when v_status = 'pending' then null else auth.uid() end
  where id = p_id;

  if not found then
    raise exception 'waitlist_entry_not_found';
  end if;

  perform public.log_admin_action(
    'waitlist_status',
    null,
    jsonb_build_object('waitlist_id', p_id, 'status', v_status)
  );
end;
$$;

revoke all on function public.admin_update_waitlist_status(uuid, text) from public;
grant execute on function public.admin_update_waitlist_status(uuid, text) to authenticated;

drop function if exists public.admin_directory_stats();

create or replace function public.admin_directory_stats()
returns table (
  client_count bigint,
  device_count bigint,
  online_device_count bigint,
  disabled_count bigint,
  pending_waitlist_count bigint
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
    count(distinct p.id) as client_count,
    count(d.id) as device_count,
    count(d.id) filter (where d.status = 'online') as online_device_count,
    count(distinct p.id) filter (where p.is_disabled) as disabled_count,
    (
      select count(*)
      from public.access_waitlist w
      where w.status = 'pending'
    ) as pending_waitlist_count
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.devices d on d.owner_id = p.id
  where u.is_anonymous = false
    and u.email is not null;
end;
$$;

revoke all on function public.admin_directory_stats() from public;
grant execute on function public.admin_directory_stats() to authenticated;
