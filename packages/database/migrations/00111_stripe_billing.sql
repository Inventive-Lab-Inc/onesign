-- Stripe subscription billing: customer/subscription ids on profiles, price ids on plan catalog.

alter table public.plan_templates
  add column if not exists stripe_product_id text,
  add column if not exists stripe_price_monthly_id text,
  add column if not exists stripe_price_annual_id text;

comment on column public.plan_templates.stripe_product_id is
  'Stripe Product id for this catalog tier (USD).';
comment on column public.plan_templates.stripe_price_monthly_id is
  'Stripe Price id for monthly billing (USD).';
comment on column public.plan_templates.stripe_price_annual_id is
  'Stripe Price id for annual billing (USD, charged once per year).';

alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text,
  add column if not exists plan_template_id uuid references public.plan_templates (id) on delete set null;

create unique index if not exists profiles_stripe_customer_id_key
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists profiles_stripe_subscription_id_key
  on public.profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists profiles_plan_template_id_idx
  on public.profiles (plan_template_id);

comment on column public.profiles.stripe_customer_id is
  'Stripe Customer id for self-serve billing.';
comment on column public.profiles.stripe_subscription_id is
  'Active Stripe Subscription id when on a paid plan.';
comment on column public.profiles.subscription_status is
  'Mirrored Stripe subscription status (active, past_due, canceled, etc.).';
comment on column public.profiles.plan_template_id is
  'Catalog plan linked to the active Stripe subscription.';

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

comment on table public.stripe_webhook_events is
  'Processed Stripe webhook event ids for idempotency.';

alter table public.stripe_webhook_events enable row level security;

-- ---------------------------------------------------------------------------
-- Service-role RPCs (Stripe webhooks via Supabase admin client)
-- ---------------------------------------------------------------------------

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

revoke all on function public.apply_stripe_subscription(uuid, text, text, text, uuid) from public;
grant execute on function public.apply_stripe_subscription(uuid, text, text, text, uuid) to service_role;

create or replace function public.revoke_stripe_subscription(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    raise exception 'Missing user id';
  end if;

  update public.profiles
  set
    stripe_subscription_id = null,
    subscription_status = 'canceled',
    plan_template_id = null,
    trial_ends_at = now(),
    plan_kind = 'trial'
  where id = p_user_id;

  if not found then
    raise exception 'User not found';
  end if;

  perform public.sync_user_app_metadata(p_user_id);
end;
$$;

revoke all on function public.revoke_stripe_subscription(uuid) from public;
grant execute on function public.revoke_stripe_subscription(uuid) to service_role;

create or replace function public.claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted boolean := false;
begin
  if p_event_id is null or p_event_id = '' then
    raise exception 'Missing event id';
  end if;

  insert into public.stripe_webhook_events (event_id, event_type)
  values (p_event_id, coalesce(p_event_type, 'unknown'))
  on conflict (event_id) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted > 0;
end;
$$;

revoke all on function public.claim_stripe_webhook_event(text, text) from public;
grant execute on function public.claim_stripe_webhook_event(text, text) to service_role;
