-- Allow apply_device_quota (security definer) to pause/unpause screens for plan limits.

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

create or replace function public.enforce_playback_disabled_admin_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('onesign.quota_apply', true) = 'true' then
    return new;
  end if;

  if new.playback_disabled is distinct from old.playback_disabled
     and not public.is_platform_staff_writer() then
    raise exception 'Only platform admins can pause or resume screens'
      using errcode = '42501';
  end if;

  if new.paused_by_quota is distinct from old.paused_by_quota
     and not public.is_platform_staff_writer() then
    raise exception 'Only platform staff can change plan pause state'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists devices_playback_disabled_admin_only on public.devices;
create trigger devices_playback_disabled_admin_only
  before update of playback_disabled, paused_by_quota on public.devices
  for each row
  execute function public.enforce_playback_disabled_admin_only();

-- Reconcile quotas now that the trigger allows internal apply.
do $$
declare
  r record;
begin
  for r in select p.id, p.device_limit from public.profiles p loop
    perform public.apply_device_quota(r.id, r.device_limit, null);
  end loop;
end;
$$;
