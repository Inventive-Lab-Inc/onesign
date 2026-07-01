-- Multi-currency plan pricing: USD (existing columns), GBP, EUR, and BDT.
-- Public pricing resolves currency from the visitor country (Vercel geo header).

alter table public.plan_templates
  add column if not exists monthly_price_gbp_cents integer not null default 0,
  add column if not exists monthly_price_eur_cents integer not null default 0,
  add column if not exists monthly_price_bdt_paisa integer not null default 0,
  add column if not exists original_price_gbp_cents integer,
  add column if not exists original_price_eur_cents integer,
  add column if not exists original_price_bdt_paisa integer;

alter table public.plan_templates
  drop constraint if exists plan_templates_gbp_price_check,
  drop constraint if exists plan_templates_eur_price_check,
  drop constraint if exists plan_templates_bdt_price_check,
  drop constraint if exists plan_templates_original_gbp_price_check,
  drop constraint if exists plan_templates_original_eur_price_check,
  drop constraint if exists plan_templates_original_bdt_price_check;

alter table public.plan_templates
  add constraint plan_templates_gbp_price_check check (monthly_price_gbp_cents >= 0),
  add constraint plan_templates_eur_price_check check (monthly_price_eur_cents >= 0),
  add constraint plan_templates_bdt_price_check check (monthly_price_bdt_paisa >= 0),
  add constraint plan_templates_original_gbp_price_check
    check (original_price_gbp_cents is null or original_price_gbp_cents >= 0),
  add constraint plan_templates_original_eur_price_check
    check (original_price_eur_cents is null or original_price_eur_cents >= 0),
  add constraint plan_templates_original_bdt_price_check
    check (original_price_bdt_paisa is null or original_price_bdt_paisa >= 0);

-- Seed placeholder values from USD so existing rows stay valid until staff edit them.
update public.plan_templates
set
  monthly_price_gbp_cents = monthly_price_cents,
  monthly_price_eur_cents = monthly_price_cents,
  monthly_price_bdt_paisa = monthly_price_cents * 100,
  original_price_gbp_cents = original_price_cents,
  original_price_eur_cents = original_price_cents,
  original_price_bdt_paisa = case
    when original_price_cents is null then null
    else original_price_cents * 100
  end
where monthly_price_gbp_cents = 0
  and monthly_price_eur_cents = 0
  and monthly_price_bdt_paisa = 0;

create or replace function public.admin_upsert_plan(
  p_id uuid,
  p_name text,
  p_tagline text,
  p_device_limit integer,
  p_storage_limit_bytes bigint,
  p_monthly_price_cents integer,
  p_original_price_cents integer,
  p_monthly_price_gbp_cents integer,
  p_original_price_gbp_cents integer,
  p_monthly_price_eur_cents integer,
  p_original_price_eur_cents integer,
  p_monthly_price_bdt_paisa integer,
  p_original_price_bdt_paisa integer,
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

  if p_monthly_price_gbp_cents is null or p_monthly_price_gbp_cents < 0 then
    raise exception 'invalid_gbp_price';
  end if;

  if p_monthly_price_eur_cents is null or p_monthly_price_eur_cents < 0 then
    raise exception 'invalid_eur_price';
  end if;

  if p_monthly_price_bdt_paisa is null or p_monthly_price_bdt_paisa < 0 then
    raise exception 'invalid_bdt_price';
  end if;

  if p_id is null then
    insert into public.plan_templates (
      name, tagline, device_limit, storage_limit_bytes,
      monthly_price_cents, original_price_cents,
      monthly_price_gbp_cents, original_price_gbp_cents,
      monthly_price_eur_cents, original_price_eur_cents,
      monthly_price_bdt_paisa, original_price_bdt_paisa,
      cta_label, features, badge, is_highlighted, is_active, sort_order
    )
    values (
      v_name,
      coalesce(trim(p_tagline), ''),
      p_device_limit,
      p_storage_limit_bytes,
      p_monthly_price_cents,
      p_original_price_cents,
      p_monthly_price_gbp_cents,
      p_original_price_gbp_cents,
      p_monthly_price_eur_cents,
      p_original_price_eur_cents,
      p_monthly_price_bdt_paisa,
      p_original_price_bdt_paisa,
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
      monthly_price_gbp_cents = p_monthly_price_gbp_cents,
      original_price_gbp_cents = p_original_price_gbp_cents,
      monthly_price_eur_cents = p_monthly_price_eur_cents,
      original_price_eur_cents = p_original_price_eur_cents,
      monthly_price_bdt_paisa = p_monthly_price_bdt_paisa,
      original_price_bdt_paisa = p_original_price_bdt_paisa,
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
  uuid, text, text, integer, bigint,
  integer, integer, integer, integer, integer, integer, integer, integer,
  text, text[], text, boolean, boolean, integer
) from public;
grant execute on function public.admin_upsert_plan(
  uuid, text, text, integer, bigint,
  integer, integer, integer, integer, integer, integer, integer, integer,
  text, text[], text, boolean, boolean, integer
) to authenticated;
