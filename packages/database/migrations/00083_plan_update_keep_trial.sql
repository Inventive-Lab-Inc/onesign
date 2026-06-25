-- Editing a client's limits must NOT silently end their trial.
-- Previously admin_update_plan cleared trial_ends_at and forced plan_kind='custom',
-- so any limit tweak (e.g. 1 -> 3 screens) permanently converted a trial into a
-- free, non-expiring account. Converting to paid is now an explicit, separate
-- action only (admin_convert_account). admin_update_plan adjusts limits and leaves
-- trial state untouched.

create or replace function public.admin_update_plan(
  p_user_id uuid,
  p_device_limit integer,
  p_storage_limit_bytes bigint,
  p_active_device_ids uuid[] default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old record;
begin
  if not public.is_platform_staff_writer() then
    raise exception 'Forbidden';
  end if;

  if p_user_id is null then
    raise exception 'Missing user id';
  end if;

  if p_device_limit is null or p_device_limit < 1 then
    raise exception 'invalid_device_limit';
  end if;

  if p_storage_limit_bytes is null or p_storage_limit_bytes < 1048576 then
    raise exception 'invalid_storage_limit';
  end if;

  select p.device_limit, p.storage_limit_bytes, p.trial_ends_at, p.plan_kind
  into v_old
  from public.profiles p
  where p.id = p_user_id
  for update;

  if v_old is null then
    raise exception 'User not found';
  end if;

  -- Limits only. trial_ends_at and plan_kind are preserved; use
  -- admin_convert_account to end a trial deliberately.
  update public.profiles
  set
    device_limit = p_device_limit,
    storage_limit_bytes = p_storage_limit_bytes
  where id = p_user_id;

  perform public.apply_device_quota(p_user_id, p_device_limit, p_active_device_ids, false);
  perform public.sync_user_app_metadata(p_user_id);

  perform public.log_admin_action(
    'plan_update',
    p_user_id,
    jsonb_build_object(
      'device_limit_before', v_old.device_limit,
      'device_limit_after', p_device_limit,
      'storage_limit_bytes_before', v_old.storage_limit_bytes,
      'storage_limit_bytes_after', p_storage_limit_bytes,
      'plan_kind', v_old.plan_kind,
      'trial_ends_at', v_old.trial_ends_at,
      'active_device_ids', coalesce(to_jsonb(p_active_device_ids), 'null'::jsonb)
    )
  );
end;
$$;

revoke all on function public.admin_update_plan(uuid, integer, bigint, uuid[]) from public;
grant execute on function public.admin_update_plan(uuid, integer, bigint, uuid[]) to authenticated;
