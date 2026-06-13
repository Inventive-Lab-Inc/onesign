-- Invitation-only client onboarding: track invites and surface pending status in admin.

create table if not exists public.client_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  invited_by uuid not null references auth.users (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  client_name text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index if not exists client_invitations_user_id_idx
  on public.client_invitations (user_id);

create index if not exists client_invitations_email_lower_idx
  on public.client_invitations (lower(email));

create unique index if not exists client_invitations_pending_email_key
  on public.client_invitations (lower(email))
  where status = 'pending';

alter table public.client_invitations enable row level security;

drop policy if exists client_invitations_select_staff on public.client_invitations;
create policy client_invitations_select_staff on public.client_invitations
  for select using (public.is_platform_staff());

comment on table public.client_invitations is
  'Admin-sent client invitations; users must accept before first sign-in.';

create or replace function public.admin_record_client_invitation(
  p_email text,
  p_user_id uuid,
  p_client_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_platform_staff_writer() then
    raise exception 'Forbidden';
  end if;

  if v_email = '' or p_user_id is null then
    raise exception 'Missing invitation fields';
  end if;

  update public.client_invitations
  set status = 'revoked'
  where lower(email) = v_email
    and status = 'pending'
    and user_id is distinct from p_user_id;

  insert into public.client_invitations (email, invited_by, user_id, client_name, status)
  values (
    v_email,
    auth.uid(),
    p_user_id,
    nullif(trim(coalesce(p_client_name, '')), ''),
    'pending'
  )
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    update public.client_invitations
    set
      invited_by = auth.uid(),
      user_id = p_user_id,
      client_name = coalesce(nullif(trim(coalesce(p_client_name, '')), ''), client_name),
      created_at = now()
    where lower(email) = v_email
      and status = 'pending'
    returning id into v_id;
  end if;

  perform public.log_admin_action(
    'client_invite',
    p_user_id,
    jsonb_build_object('email', v_email, 'client_name', nullif(trim(coalesce(p_client_name, '')), ''))
  );

  return v_id;
end;
$$;

revoke all on function public.admin_record_client_invitation(text, uuid, text) from public;
grant execute on function public.admin_record_client_invitation(text, uuid, text) to authenticated;

create or replace function public.mark_client_invitation_accepted()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.client_invitations
  set
    status = 'accepted',
    accepted_at = now(),
    user_id = auth.uid()
  where user_id = auth.uid()
    and status = 'pending';

  if not found then
    update public.client_invitations
    set
      status = 'accepted',
      accepted_at = now(),
      user_id = auth.uid()
    where lower(email) = (
      select lower(u.email)
      from auth.users u
      where u.id = auth.uid()
    )
      and status = 'pending';
  end if;
end;
$$;

revoke all on function public.mark_client_invitation_accepted() from public;
grant execute on function public.mark_client_invitation_accepted() to authenticated;

-- admin_list_users: expose invitation_pending for admin directory
drop function if exists public.admin_list_users(integer, integer, text, text);

create or replace function public.admin_list_users(
  p_limit integer default 50,
  p_offset integer default 0,
  p_search text default null,
  p_status text default 'all'
)
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
  is_staff boolean,
  invitation_pending boolean,
  total_count bigint
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_limit integer := greatest(coalesce(p_limit, 50), 1);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_status text := lower(coalesce(nullif(trim(p_status), ''), 'all'));
begin
  if not public.is_platform_staff() then
    raise exception 'Forbidden';
  end if;

  if v_status not in ('all', 'active', 'disabled') then
    raise exception 'invalid_status_filter';
  end if;

  if v_limit > 200 then
    v_limit := 200;
  end if;

  return query
  with filtered as (
    select
      p.id,
      u.email::text as email,
      public.profile_display_name(p.client_name, u.email::text) as client_name,
      p.created_at,
      count(d.id) as device_count,
      count(d.id) filter (where d.status = 'online') as online_device_count,
      count(d.id) filter (where not d.paused_by_quota and not d.playback_disabled) as active_device_count,
      p.device_limit,
      p.storage_used_bytes,
      p.storage_limit_bytes,
      p.is_disabled,
      exists (
        select 1
        from public.platform_staff s
        where s.user_id = p.id
          and s.is_active
      ) as is_staff,
      (
        u.last_sign_in_at is null
        and exists (
          select 1
          from public.client_invitations ci
          where ci.user_id = p.id
            and ci.status = 'pending'
        )
      ) as invitation_pending
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.devices d on d.owner_id = p.id
    where u.is_anonymous = false
      and u.email is not null
      and (
        v_status = 'all'
        or (v_status = 'active' and not p.is_disabled)
        or (v_status = 'disabled' and p.is_disabled)
      )
      and (
        v_search is null
        or lower(u.email) like '%' || lower(v_search) || '%'
        or lower(public.profile_display_name(p.client_name, u.email::text)) like '%' || lower(v_search) || '%'
        or similarity(lower(public.profile_display_name(p.client_name, u.email::text)), lower(v_search)) > 0.25
        or similarity(lower(u.email::text), lower(v_search)) > 0.25
      )
    group by
      p.id,
      u.email,
      p.client_name,
      p.created_at,
      p.device_limit,
      p.storage_used_bytes,
      p.storage_limit_bytes,
      p.is_disabled,
      u.last_sign_in_at
  )
  select
    f.id,
    f.email,
    f.client_name,
    f.created_at,
    f.device_count,
    f.online_device_count,
    f.active_device_count,
    f.device_limit,
    f.storage_used_bytes,
    f.storage_limit_bytes,
    f.is_disabled,
    f.is_staff,
    f.invitation_pending,
    count(*) over() as total_count
  from filtered f
  order by f.created_at desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.admin_list_users(integer, integer, text, text) from public;
grant execute on function public.admin_list_users(integer, integer, text, text) to authenticated;
