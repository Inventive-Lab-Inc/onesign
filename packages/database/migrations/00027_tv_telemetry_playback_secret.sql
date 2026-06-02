-- Telemetry used the JWT-only path; linked TVs that rotated anonymous auth could not
-- report version/hardware while still playing via playback_secret heartbeats.
-- Align auth with tv_device_heartbeat.

drop function if exists public.tv_device_report_telemetry(uuid, jsonb);

create or replace function public.tv_device_report_telemetry(
  p_device_id uuid,
  p_telemetry jsonb,
  p_playback_secret text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg uuid;
  v_secret text;
  v_ok_secret boolean := false;
begin
  if not exists (select 1 from public.devices d where d.id = p_device_id) then
    return;
  end if;

  select d.registered_session_id
  into v_reg
  from public.devices d
  where d.id = p_device_id;

  select c.secret
  into v_secret
  from public.device_playback_credentials c
  where c.device_id = p_device_id;

  if p_playback_secret is not null
     and trim(p_playback_secret) <> ''
     and v_secret is not null
     and trim(v_secret) <> ''
     and v_secret = p_playback_secret then
    v_ok_secret := true;
  end if;

  if not v_ok_secret then
    if auth.uid() is null then
      return;
    end if;
    if v_reg is null or v_reg is distinct from auth.uid() then
      return;
    end if;
  end if;

  update public.devices d
  set
    telemetry = coalesce(d.telemetry, '{}'::jsonb) || coalesce(p_telemetry, '{}'::jsonb),
    telemetry_at = now(),
    last_seen = now(),
    status = 'online'
  where d.id = p_device_id
    and (
      v_ok_secret
      or (
        auth.uid() is not null
        and d.registered_session_id is not distinct from auth.uid()
      )
    );
end;
$$;

revoke all on function public.tv_device_report_telemetry(uuid, jsonb, text) from public;
grant execute on function public.tv_device_report_telemetry(uuid, jsonb, text) to anon, authenticated;
