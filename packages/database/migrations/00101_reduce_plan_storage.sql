-- Reduce plan storage quotas: Free 100 MB → Solo 500 MB → Growth 3 GB → Network 10 GB.

update public.plan_templates
set
  storage_limit_bytes = case name
    when 'Free' then 104857600::bigint
    when 'Solo' then 524288000::bigint
    when 'Growth' then 3221225472::bigint
    when 'Network' then 10737418240::bigint
    else storage_limit_bytes
  end,
  features = case name
    when 'Free' then array[
      '100 MB media storage',
      'OneSign watermark on screen',
      'Image & video playlists',
      'Basic scheduling'
    ]
    when 'Solo' then array[
      '500 MB media storage',
      'No watermark',
      'Scheduling & live widgets',
      'Email support'
    ]
    when 'Growth' then array[
      '3 GB media storage',
      'Screen groups & bulk deploy',
      'Website & live widgets',
      'Advanced scheduling',
      'Priority email support'
    ]
    when 'Network' then array[
      '10 GB media storage',
      'Unlimited groups & playlists',
      'Audit logs & team roles',
      'Priority + phone support'
    ]
    else features
  end,
  updated_at = now()
where name in ('Free', 'Solo', 'Growth', 'Network');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_name text;
  v_skip_trial boolean;
  v_skip_account_setup boolean;
  v_plan_slug text;
  v_workspace_id uuid;
  v_device_limit integer;
  v_storage_limit_bytes bigint;
  v_trial_ends_at timestamptz;
  v_plan_kind text;
begin
  v_client_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), '')
  );

  v_skip_trial := coalesce(new.raw_user_meta_data->>'skip_trial', '') = 'true';
  v_skip_account_setup := coalesce(new.raw_user_meta_data->>'skip_account_setup', '') = 'true';
  v_plan_slug := lower(nullif(trim(new.raw_user_meta_data->>'plan_slug'), ''));

  if v_skip_trial then
    v_device_limit := 1;
    v_storage_limit_bytes := 524288000;
    v_trial_ends_at := null;
    v_plan_kind := 'standard';
  elsif v_plan_slug = 'free' then
    v_device_limit := 1;
    v_storage_limit_bytes := 104857600;
    v_trial_ends_at := null;
    v_plan_kind := 'free';
  else
    v_device_limit := 3;
    v_storage_limit_bytes := 3221225472;
    v_trial_ends_at := now() + interval '14 days';
    v_plan_kind := 'trial';
  end if;

  insert into public.profiles (
    id,
    client_name,
    device_limit,
    storage_limit_bytes,
    trial_ends_at,
    plan_kind
  )
  values (
    new.id,
    v_client_name,
    v_device_limit,
    v_storage_limit_bytes,
    v_trial_ends_at,
    v_plan_kind
  )
  on conflict (id) do nothing;

  perform public.sync_user_app_metadata(new.id);

  if coalesce(new.is_anonymous, false) = false and not v_skip_account_setup then
    select w.id into v_workspace_id
    from public.workspaces w
    where w.account_id = new.id and w.is_default
    limit 1;

    if v_workspace_id is null then
      insert into public.workspaces (account_id, name, is_default)
      values (new.id, 'Default workspace', true)
      returning id into v_workspace_id;
    end if;

    insert into public.account_members (account_id, user_id, is_owner)
    values (new.id, new.id, true)
    on conflict (account_id, user_id) do nothing;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (v_workspace_id, new.id, 'owner')
    on conflict (workspace_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.reconcile_expired_trial(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated boolean := false;
begin
  if p_user_id is null then
    return false;
  end if;

  update public.profiles p
  set
    device_limit = 1,
    storage_limit_bytes = 104857600,
    plan_kind = 'free',
    trial_ends_at = null
  where p.id = p_user_id
    and p.plan_kind = 'trial'
    and p.trial_ends_at is not null
    and p.trial_ends_at <= now()
  returning true into v_updated;

  if coalesce(v_updated, false) then
    perform public.apply_device_quota(p_user_id, 1, null, false);
    perform public.sync_user_app_metadata(p_user_id);
  end if;

  return coalesce(v_updated, false);
end;
$$;

revoke all on function public.reconcile_expired_trial(uuid) from public;
grant execute on function public.reconcile_expired_trial(uuid) to authenticated;
