-- QA urgent (7 Nov 2026):
-- 1) Safer Stripe revoke: keep manual-billed / custom / staff entitlements; only clear Stripe fields.
-- 2) Cleanup orphan empty auto-named screen playlists.
-- 3) Align mark_stale_devices_offline window with UI (90s).
-- 4) Service-role helper to mark stale online devices globally (ops / cron).

-- ---------------------------------------------------------------------------
-- Stripe revoke: do not lock manual-billed or staff accounts into expired trial
-- ---------------------------------------------------------------------------

create or replace function public.revoke_stripe_subscription(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_preserve_entitlements boolean := false;
begin
  if p_user_id is null then
    raise exception 'Missing user id';
  end if;

  select exists (
    select 1 from public.account_billing ab where ab.account_id = p_user_id
  )
  or exists (
    select 1
    from public.platform_staff ps
    where ps.user_id = p_user_id
      and ps.is_active
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.plan_kind = 'custom'
  )
  into v_preserve_entitlements;

  perform set_config('onesign.stripe_apply', 'true', true);

  if v_preserve_entitlements then
    update public.profiles
    set
      stripe_subscription_id = null,
      subscription_status = 'canceled'
    where id = p_user_id;
  else
    update public.profiles
    set
      stripe_subscription_id = null,
      subscription_status = 'canceled',
      plan_template_id = null,
      trial_ends_at = now(),
      plan_kind = 'trial'
    where id = p_user_id;
  end if;

  if not found then
    raise exception 'User not found';
  end if;

  perform public.sync_user_app_metadata(p_user_id);
end;
$$;

revoke all on function public.revoke_stripe_subscription(uuid) from public;
grant execute on function public.revoke_stripe_subscription(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Device online staleness: match console UI (90s)
-- ---------------------------------------------------------------------------

create or replace function public.mark_stale_devices_offline(p_owner_id uuid default auth.uid())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if auth.uid() is null then
    return 0;
  end if;

  if p_owner_id is null then
    return 0;
  end if;

  if p_owner_id <> auth.uid()
     and not public.is_platform_staff_writer() then
    return 0;
  end if;

  update public.devices d
  set status = 'offline'
  where d.owner_id = p_owner_id
    and d.status = 'online'
    and (
      d.last_seen is null
      or d.last_seen < now() - interval '90 seconds'
    );

  get diagnostics n = row_count;
  return coalesce(n, 0);
end;
$$;

revoke all on function public.mark_stale_devices_offline(uuid) from public;
grant execute on function public.mark_stale_devices_offline(uuid) to authenticated;

-- Global ops helper (service role / cron). Does not touch other tenants' pairing rows.
create or replace function public.mark_all_stale_devices_offline(p_stale_seconds integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
  v_seconds integer := greatest(coalesce(p_stale_seconds, 90), 30);
begin
  update public.devices d
  set status = 'offline'
  where d.owner_id is not null
    and d.status = 'online'
    and (
      d.last_seen is null
      or d.last_seen < now() - make_interval(secs => v_seconds)
    );

  get diagnostics n = row_count;
  return coalesce(n, 0);
end;
$$;

revoke all on function public.mark_all_stale_devices_offline(integer) from public;
grant execute on function public.mark_all_stale_devices_offline(integer) to service_role;

-- ---------------------------------------------------------------------------
-- Delete empty auto-named "— screen" / "— group" playlists not assigned to devices
-- ---------------------------------------------------------------------------

create or replace function public.cleanup_orphan_empty_screen_playlists()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  with orphan as (
    select p.id
    from public.playlists p
    where (
        p.name ~* '\s—\s(screen|group)\s*$'
        or p.name ~* '\s-\s(screen|group)\s*$'
      )
      and not exists (
        select 1 from public.playlist_items pi where pi.playlist_id = p.id
      )
      and not exists (
        select 1 from public.device_playlists dp where dp.playlist_id = p.id
      )
      and not exists (
        select 1 from public.device_groups dg where dg.playlist_id = p.id
      )
      and not exists (
        select 1 from public.playlist_group_members pgm where pgm.playlist_id = p.id
      )
  )
  delete from public.playlists p
  using orphan
  where p.id = orphan.id;

  get diagnostics n = row_count;
  return coalesce(n, 0);
end;
$$;

revoke all on function public.cleanup_orphan_empty_screen_playlists() from public;
grant execute on function public.cleanup_orphan_empty_screen_playlists() to service_role;
