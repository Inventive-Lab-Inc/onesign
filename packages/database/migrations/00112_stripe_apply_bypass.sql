-- Allow Stripe subscription RPCs to update device/storage limits (normally staff-only).

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

  if new.storage_limit_bytes is distinct from old.storage_limit_bytes
     and not public.is_platform_staff_writer() then
    raise exception 'Only platform staff can change storage limits'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.apply_stripe_subscription(
  p_user_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_subscription_status text,
  p_plan_template_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.plan_templates;
begin
  if p_user_id is null then
    raise exception 'Missing user id';
  end if;

  if p_plan_template_id is null then
    raise exception 'Missing plan template id';
  end if;

  select *
  into v_plan
  from public.plan_templates pt
  where pt.id = p_plan_template_id
    and pt.is_active;

  if v_plan.id is null then
    raise exception 'plan_not_found';
  end if;

  perform set_config('onesign.stripe_apply', 'true', true);

  update public.profiles
  set
    stripe_customer_id = coalesce(p_stripe_customer_id, stripe_customer_id),
    stripe_subscription_id = p_stripe_subscription_id,
    subscription_status = p_subscription_status,
    plan_template_id = p_plan_template_id,
    device_limit = v_plan.device_limit,
    storage_limit_bytes = v_plan.storage_limit_bytes,
    trial_ends_at = null,
    plan_kind = 'standard'
  where id = p_user_id;

  if not found then
    raise exception 'User not found';
  end if;

  perform public.apply_device_quota(p_user_id, v_plan.device_limit, null, false);
  perform public.sync_user_app_metadata(p_user_id);
end;
$$;
