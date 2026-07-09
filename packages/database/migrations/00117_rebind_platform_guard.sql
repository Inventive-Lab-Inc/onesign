-- Re-pair must connect the same player type: native Android TV app vs browser player.
-- Browser player may run on Android hardware; platform reflects the client app, not the device OS.

drop function if exists public.rebind_device_by_pairing_code(uuid, text, uuid);

create or replace function public.rebind_device_by_pairing_code(
  p_device_id uuid,
  p_code text,
  p_owner_id uuid default null,
  p_allow_platform_change boolean default false
)
returns public.devices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.devices;
  v_pending public.devices;
  v_owner_id uuid;
  v_saved_android_id text;
  v_saved_registered_session_id uuid;
  v_saved_platform text;
  v_saved_telemetry jsonb;
  v_saved_telemetry_at timestamptz;
  v_saved_pairing_code text;
begin
  if p_code !~ '^[0-9]{6}$' then
    raise exception 'invalid_pairing_code';
  end if;

  v_owner_id := coalesce(p_owner_id, public.primary_account_id());
  if v_owner_id is null then
    v_owner_id := auth.uid();
  end if;

  if v_owner_id is null then
    raise exception 'not_authenticated';
  end if;

  if public.profile_is_trial_expired(v_owner_id) then
    raise exception 'trial_expired';
  end if;

  if p_owner_id is not null and p_owner_id is distinct from auth.uid() then
    if not public.is_platform_staff_writer()
       and not exists (
         select 1 from public.account_members am
         where am.account_id = p_owner_id and am.user_id = auth.uid()
       ) then
      raise exception 'Forbidden';
    end if;
  elsif v_owner_id is distinct from auth.uid() then
    if not exists (
      select 1 from public.account_members am
      where am.account_id = v_owner_id and am.user_id = auth.uid()
    ) and not public.is_platform_staff_writer() then
      raise exception 'Forbidden';
    end if;
  end if;

  select * into strict v_target
  from public.devices d
  where d.id = p_device_id
    and d.owner_id = v_owner_id;

  if v_target.workspace_id is not null then
    if not public.workspace_has_permission(v_target.workspace_id, 'manage_screens')
       and not public.is_platform_staff_writer()
       and not public.is_account_owner(v_owner_id) then
      raise exception 'forbidden';
    end if;
  end if;

  select * into strict v_pending
  from public.devices d
  where d.pairing_code = p_code
    and d.owner_id is null;

  if v_pending.id = v_target.id then
    raise exception 'device_not_found_or_already_linked';
  end if;

  if v_pending.platform is distinct from v_target.platform
     and not coalesce(p_allow_platform_change, false) then
    raise exception 'platform_mismatch'
      using hint = v_target.platform || '->' || v_pending.platform;
  end if;

  v_saved_android_id := v_pending.android_id;
  v_saved_registered_session_id := v_pending.registered_session_id;
  v_saved_platform := v_pending.platform;
  v_saved_telemetry := v_pending.telemetry;
  v_saved_telemetry_at := v_pending.telemetry_at;
  v_saved_pairing_code := v_pending.pairing_code;

  delete from public.devices where id = v_pending.id;

  update public.devices
  set
    android_id = v_saved_android_id,
    registered_session_id = v_saved_registered_session_id,
    platform = v_saved_platform,
    telemetry = coalesce(v_saved_telemetry, telemetry),
    telemetry_at = coalesce(v_saved_telemetry_at, telemetry_at),
    pairing_code = v_saved_pairing_code,
    status = 'offline',
    last_seen = now()
  where id = v_target.id
  returning * into strict v_target;

  insert into public.device_playback_credentials (device_id, secret)
  values (v_target.id, lower(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')))
  on conflict (device_id) do update set secret = excluded.secret;

  return v_target;
exception
  when no_data_found then
    raise exception 'device_not_found_or_already_linked';
end;
$$;

revoke all on function public.rebind_device_by_pairing_code(uuid, text, uuid, boolean) from public;
grant execute on function public.rebind_device_by_pairing_code(uuid, text, uuid, boolean) to authenticated;
