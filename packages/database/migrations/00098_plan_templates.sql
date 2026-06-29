-- Plan catalog managed from the admin portal. Replaces the hardcoded marketing
-- tiers with a DB-backed table that staff can create, edit, reorder, and retire.
-- Customers read only the active rows; full control lives in /admin/plans.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table if not exists public.plan_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tagline text not null default '',
  device_limit integer not null default 1,
  storage_limit_bytes bigint not null default 524288000,
  monthly_price_cents integer not null default 0,
  original_price_cents integer,
  cta_label text not null default 'Choose plan',
  features text[] not null default '{}'::text[],
  badge text,
  is_highlighted boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_templates_device_limit_check check (device_limit >= 1),
  constraint plan_templates_storage_check check (storage_limit_bytes >= 1048576),
  constraint plan_templates_price_check check (monthly_price_cents >= 0),
  constraint plan_templates_original_price_check
    check (original_price_cents is null or original_price_cents >= 0)
);

comment on table public.plan_templates is
  'Catalog of subscription plans managed by platform staff. Active rows drive the public pricing page.';

create index if not exists plan_templates_active_sort_idx
  on public.plan_templates (is_active, sort_order, name);

-- ---------------------------------------------------------------------------
-- RLS: staff full read; everyone reads active plans (public pricing page)
-- ---------------------------------------------------------------------------

alter table public.plan_templates enable row level security;

drop policy if exists plan_templates_read_active on public.plan_templates;
create policy plan_templates_read_active
  on public.plan_templates
  for select
  using (is_active or public.is_platform_staff());

-- Writes go exclusively through the security-definer RPCs below.

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.list_active_plans()
returns setof public.plan_templates
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.plan_templates
  where is_active
  order by sort_order, name;
$$;

revoke all on function public.list_active_plans() from public;
grant execute on function public.list_active_plans() to anon, authenticated;

create or replace function public.admin_list_plans()
returns setof public.plan_templates
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_staff() then
    raise exception 'Forbidden';
  end if;

  return query
  select *
  from public.plan_templates
  order by sort_order, name;
end;
$$;

revoke all on function public.admin_list_plans() from public;
grant execute on function public.admin_list_plans() to authenticated;

create or replace function public.admin_upsert_plan(
  p_id uuid,
  p_name text,
  p_tagline text,
  p_device_limit integer,
  p_storage_limit_bytes bigint,
  p_monthly_price_cents integer,
  p_original_price_cents integer,
  p_cta_label text,
  p_features text[],
  p_badge text,
  p_is_highlighted boolean,
  p_is_active boolean,
  p_sort_order integer
)
returns public.plan_templates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(trim(p_name), '');
  v_features text[] := coalesce(p_features, '{}'::text[]);
  v_sort integer := coalesce(p_sort_order, 0);
  result public.plan_templates;
begin
  if not public.is_platform_staff_writer() then
    raise exception 'Forbidden';
  end if;

  if v_name is null then
    raise exception 'plan_name_required';
  end if;

  if p_device_limit is null or p_device_limit < 1 then
    raise exception 'invalid_device_limit';
  end if;

  if p_storage_limit_bytes is null or p_storage_limit_bytes < 1048576 then
    raise exception 'invalid_storage_limit';
  end if;

  if p_monthly_price_cents is null or p_monthly_price_cents < 0 then
    raise exception 'invalid_price';
  end if;

  if p_id is null then
    insert into public.plan_templates (
      name, tagline, device_limit, storage_limit_bytes, monthly_price_cents,
      original_price_cents, cta_label, features, badge, is_highlighted,
      is_active, sort_order
    )
    values (
      v_name,
      coalesce(trim(p_tagline), ''),
      p_device_limit,
      p_storage_limit_bytes,
      p_monthly_price_cents,
      p_original_price_cents,
      coalesce(nullif(trim(p_cta_label), ''), 'Choose plan'),
      v_features,
      nullif(trim(p_badge), ''),
      coalesce(p_is_highlighted, false),
      coalesce(p_is_active, true),
      v_sort
    )
    returning * into result;

    perform public.log_admin_action(
      'plan_template_save',
      null,
      jsonb_build_object('plan_id', result.id, 'name', result.name, 'created', true)
    );
  else
    update public.plan_templates
    set
      name = v_name,
      tagline = coalesce(trim(p_tagline), ''),
      device_limit = p_device_limit,
      storage_limit_bytes = p_storage_limit_bytes,
      monthly_price_cents = p_monthly_price_cents,
      original_price_cents = p_original_price_cents,
      cta_label = coalesce(nullif(trim(p_cta_label), ''), 'Choose plan'),
      features = v_features,
      badge = nullif(trim(p_badge), ''),
      is_highlighted = coalesce(p_is_highlighted, false),
      is_active = coalesce(p_is_active, true),
      sort_order = v_sort,
      updated_at = now()
    where id = p_id
    returning * into result;

    if result.id is null then
      raise exception 'plan_not_found';
    end if;

    perform public.log_admin_action(
      'plan_template_save',
      null,
      jsonb_build_object('plan_id', result.id, 'name', result.name, 'created', false)
    );
  end if;

  return result;
end;
$$;

revoke all on function public.admin_upsert_plan(
  uuid, text, text, integer, bigint, integer, integer, text, text[], text, boolean, boolean, integer
) from public;
grant execute on function public.admin_upsert_plan(
  uuid, text, text, integer, bigint, integer, integer, text, text[], text, boolean, boolean, integer
) to authenticated;

create or replace function public.admin_delete_plan(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if not public.is_platform_staff_writer() then
    raise exception 'Forbidden';
  end if;

  if p_id is null then
    raise exception 'Missing plan id';
  end if;

  delete from public.plan_templates
  where id = p_id
  returning name into v_name;

  if v_name is null then
    raise exception 'plan_not_found';
  end if;

  perform public.log_admin_action(
    'plan_template_delete',
    null,
    jsonb_build_object('plan_id', p_id, 'name', v_name)
  );
end;
$$;

revoke all on function public.admin_delete_plan(uuid) from public;
grant execute on function public.admin_delete_plan(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed the current marketing tiers so the catalog is not empty on first load.
-- ---------------------------------------------------------------------------

insert into public.plan_templates (
  name, tagline, device_limit, storage_limit_bytes, monthly_price_cents,
  original_price_cents, cta_label, features, badge, is_highlighted, is_active, sort_order
)
select * from (values
  (
    'Starter', 'For a single storefront', 1, 2147483648::bigint, 1900, 2900,
    'Choose Starter',
    array['2 GB media storage', 'Image & video playlists', 'Basic scheduling', 'Email support'],
    null::text, false, true, 0
  ),
  (
    'Business', 'For growing multi-location teams', 5, 26843545600::bigint, 5900, 7900,
    'Choose Business',
    array['25 GB media storage', 'Screen groups & bulk deploy', 'Website & live widgets', 'Advanced scheduling', 'Priority email support'],
    'MOST POPULAR', true, true, 1
  ),
  (
    'Enterprise', 'For agencies & large networks', 20, 268435456000::bigint, 14900, 19900,
    'Choose Enterprise',
    array['250 GB media storage', 'Unlimited groups & playlists', 'Audit logs & team roles', 'Dedicated account manager', 'Priority + phone support'],
    null::text, false, true, 2
  )
) as seed(name, tagline, device_limit, storage_limit_bytes, monthly_price_cents, original_price_cents, cta_label, features, badge, is_highlighted, is_active, sort_order)
where not exists (select 1 from public.plan_templates);
