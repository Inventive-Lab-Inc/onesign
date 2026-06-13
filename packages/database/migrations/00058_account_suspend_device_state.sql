-- Account suspend must not corrupt device playback flags.
-- TVs already honour profiles.is_disabled via device_effective_playback_disabled().
-- Re-enable restores quota-active screens and preserves manually disabled devices.

alter table public.profiles
  add column if not exists devices_disabled_before_suspend uuid[];

comment on column public.profiles.devices_disabled_before_suspend is
  'Snapshot of manually disabled device ids taken when the account is suspended; restored on re-enable.';

drop function if exists public.apply_device_quota(uuid, integer, uuid[]);

create or replace function public.apply_device_quota(
  p_user_id uuid,
  p_limit integer,
  p_active_device_ids uuid[] default null,
  p_preserve_manual_disables boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active uuid[];
  v_preserve_manual boolean;
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
    v_preserve_manual := false;
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

    v_preserve_manual := p_preserve_manual_disables;
  end if;

  update public.devices d
  set
    paused_by_quota = true,
    playback_disabled = true
  where d.owner_id = p_user_id
    and not (d.id = any(v_active));

  if v_preserve_manual then
    update public.devices d
    set
      paused_by_quota = false,
      playback_disabled = case
        when d.playback_disabled and not coalesce(d.paused_by_quota, false) then true
        else false
      end
    where d.owner_id = p_user_id
      and d.id = any(v_active);
  else
    update public.devices d
    set
      paused_by_quota = false,
      playback_disabled = false
    where d.owner_id = p_user_id
      and d.id = any(v_active);
  end if;
end;
$$;

revoke all on function public.apply_device_quota(uuid, integer, uuid[], boolean) from public;
grant execute on function public.apply_device_quota(uuid, integer, uuid[], boolean) to authenticated;

create or replace function public.admin_set_account_disabled(p_user_id uuid, p_disabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_was_disabled boolean;
  v_manual uuid[];
begin
  if not public.is_platform_staff_writer() then
    raise exception 'Forbidden';
  end if;

  if p_user_id is null then
    raise exception 'Missing user id';
  end if;

  if exists (
    select 1
    from public.platform_staff s
    where s.user_id = p_user_id
      and s.is_active
  ) then
    raise exception 'Cannot disable platform staff accounts';
  end if;

  select p.is_disabled
  into v_was_disabled
  from public.profiles p
  where p.id = p_user_id;

  if not found then
    raise exception 'User not found';
  end if;

  if p_disabled then
    update public.profiles p
    set
      is_disabled = true,
      devices_disabled_before_suspend = (
        select coalesce(array_agg(d.id), array[]::uuid[])
        from public.devices d
        where d.owner_id = p_user_id
          and d.playback_disabled
          and not coalesce(d.paused_by_quota, false)
      )
    where p.id = p_user_id;
  else
    select p.device_limit, p.devices_disabled_before_suspend
    into v_limit, v_manual
    from public.profiles p
    where p.id = p_user_id;

    update public.profiles p
    set
      is_disabled = false,
      devices_disabled_before_suspend = null
    where p.id = p_user_id;

    perform public.apply_device_quota(p_user_id, coalesce(v_limit, 1), null, false);

    if v_manual is not null and coalesce(array_length(v_manual, 1), 0) > 0 then
      update public.devices d
      set
        playback_disabled = true,
        paused_by_quota = false
      where d.owner_id = p_user_id
        and d.id = any(v_manual);
    end if;
  end if;

  perform public.sync_user_app_metadata(p_user_id);

  if v_was_disabled is distinct from p_disabled then
    perform public.log_admin_action(
      case when p_disabled then 'account_disable' else 'account_enable' end,
      p_user_id,
      jsonb_build_object('was_disabled', v_was_disabled, 'is_disabled', p_disabled)
    );
  end if;
end;
$$;

-- Heal accounts trapped by the legacy suspend flow (all screens left playback_disabled).
do $$
declare
  r record;
begin
  for r in
    select p.id, coalesce(p.device_limit, 1) as device_limit
    from public.profiles p
    where not coalesce(p.is_disabled, false)
      and exists (
        select 1
        from public.devices d
        where d.owner_id = p.id
      )
      and not exists (
        select 1
        from public.devices d
        where d.owner_id = p.id
          and not d.playback_disabled
      )
      and exists (
        select 1
        from public.devices d
        where d.owner_id = p.id
          and d.playback_disabled
          and not coalesce(d.paused_by_quota, false)
      )
  loop
    perform public.apply_device_quota(r.id, r.device_limit, null, false);
  end loop;
end;
$$;
