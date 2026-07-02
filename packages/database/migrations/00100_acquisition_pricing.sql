-- Acquisition-first pricing: Free / Solo / Growth / Network tiers, 14-day Growth
-- trial (3 screens, 3 GB), and automatic downgrade to Free when a trial ends.

-- ---------------------------------------------------------------------------
-- Retire legacy Starter / Business / Enterprise catalog rows
-- ---------------------------------------------------------------------------

update public.plan_templates
set is_active = false, updated_at = now()
where name in ('Starter', 'Business', 'Enterprise');

-- ---------------------------------------------------------------------------
-- New public catalog (skip if staff already created rows with these names)
-- ---------------------------------------------------------------------------

insert into public.plan_templates (
  name,
  tagline,
  device_limit,
  storage_limit_bytes,
  monthly_price_cents,
  original_price_cents,
  monthly_price_gbp_cents,
  original_price_gbp_cents,
  monthly_price_eur_cents,
  original_price_eur_cents,
  monthly_price_bdt_paisa,
  original_price_bdt_paisa,
  cta_label,
  features,
  badge,
  is_highlighted,
  is_active,
  sort_order
)
select * from (values
  (
    'Free',
    'One screen, forever',
    1,
    104857600::bigint,
    0,
    null::integer,
    0,
    null::integer,
    0,
    null::integer,
    0,
    null::integer,
    'Get started free',
    array[
      '100 MB media storage',
      'OneSign watermark on screen',
      'Image & video playlists',
      'Basic scheduling'
    ],
    null::text,
    false,
    true,
    0
  ),
  (
    'Solo',
    'For a single location',
    1,
    524288000::bigint,
    900,
    1200,
    700,
    900,
    800,
    1000,
    90000,
    120000,
    'Choose Solo',
    array[
      '500 MB media storage',
      'No watermark',
      'Scheduling & live widgets',
      'Email support'
    ],
    null::text,
    false,
    true,
    1
  ),
  (
    'Growth',
    'For growing multi-location teams',
    5,
    3221225472::bigint,
    3900,
    4900,
    3200,
    4000,
    3500,
    4400,
    390000,
    490000,
    'Choose Growth',
    array[
      '3 GB media storage',
      'Screen groups & bulk deploy',
      'Website & live widgets',
      'Advanced scheduling',
      'Priority email support'
    ],
    'MOST POPULAR',
    true,
    true,
    2
  ),
  (
    'Network',
    'For agencies & larger fleets',
    15,
    10737418240::bigint,
    8900,
    10900,
    7400,
    9100,
    8200,
    10100,
    890000,
    1090000,
    'Choose Network',
    array[
      '10 GB media storage',
      'Unlimited groups & playlists',
      'Audit logs & team roles',
      'Priority + phone support'
    ],
    null::text,
    false,
    true,
    3
  )
) as seed(
  name, tagline, device_limit, storage_limit_bytes,
  monthly_price_cents, original_price_cents,
  monthly_price_gbp_cents, original_price_gbp_cents,
  monthly_price_eur_cents, original_price_eur_cents,
  monthly_price_bdt_paisa, original_price_bdt_paisa,
  cta_label, features, badge, is_highlighted, is_active, sort_order
)
where not exists (
  select 1 from public.plan_templates pt where pt.name = seed.name
);

-- ---------------------------------------------------------------------------
-- Signup: 14-day Growth trial by default; Free tier via plan_slug metadata
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- When a Growth trial ends, downgrade to the Free tier instead of hard-locking
-- ---------------------------------------------------------------------------

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
