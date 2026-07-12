-- Allow trusted server (service_role) and staff writers to change device/storage limits.
-- provision-client was updating profiles via the service-role key; auth.uid() is null in
-- that context, so the staff-only trigger rejected legitimate admin plan changes.

create or replace function public.enforce_profile_device_limit_admin_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('onesign.stripe_apply', true) = 'true' then
    return new;
  end if;

  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.device_limit is distinct from old.device_limit
     and not public.is_platform_staff_writer() then
    raise exception 'Only platform staff can change device limits'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_profile_storage_limit_admin_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('onesign.stripe_apply', true) = 'true' then
    return new;
  end if;

  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.storage_limit_bytes is distinct from old.storage_limit_bytes
     and not public.is_platform_staff_writer() then
    raise exception 'Only platform staff can change storage limits'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Staff-authenticated provisioning (catalog / trial / custom) for client accounts.
create or replace function public.admin_provision_client(
  p_user_id uuid,
  p_device_limit integer,
  p_storage_limit_bytes bigint,
  p_trial_ends_at timestamptz,
  p_plan_kind text,
  p_plan_template_id uuid default null
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

  if p_plan_kind is null or p_plan_kind not in ('trial', 'standard', 'custom', 'free') then
    raise exception 'invalid_plan_kind';
  end if;

  select
    p.device_limit,
    p.storage_limit_bytes,
    p.trial_ends_at,
    p.plan_kind,
    p.plan_template_id
  into v_old
  from public.profiles p
  where p.id = p_user_id
  for update;

  if v_old is null then
    raise exception 'User not found';
  end if;

  update public.profiles
  set
    device_limit = p_device_limit,
    storage_limit_bytes = p_storage_limit_bytes,
    trial_ends_at = p_trial_ends_at,
    plan_kind = p_plan_kind,
    plan_template_id = p_plan_template_id
  where id = p_user_id;

  perform public.apply_device_quota(p_user_id, p_device_limit, null, false);
  perform public.sync_user_app_metadata(p_user_id);

  perform public.log_admin_action(
    'plan_update',
    p_user_id,
    jsonb_build_object(
      'device_limit_before', v_old.device_limit,
      'device_limit_after', p_device_limit,
      'storage_limit_bytes_before', v_old.storage_limit_bytes,
      'storage_limit_bytes_after', p_storage_limit_bytes,
      'plan_kind_before', v_old.plan_kind,
      'plan_kind_after', p_plan_kind,
      'trial_ends_at_before', v_old.trial_ends_at,
      'trial_ends_at_after', p_trial_ends_at,
      'plan_template_id_before', v_old.plan_template_id,
      'plan_template_id_after', p_plan_template_id,
      'source', 'admin_provision_client'
    )
  );
end;
$$;

revoke all on function public.admin_provision_client(uuid, integer, bigint, timestamptz, text, uuid) from public;
grant execute on function public.admin_provision_client(uuid, integer, bigint, timestamptz, text, uuid) to authenticated;
