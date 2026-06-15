-- TV app calls this when shutting down so the console flips offline immediately
-- instead of waiting for last_seen to age out.

create or replace function public.tv_device_offline(p_device_id uuid, p_playback_secret text default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_reg uuid;
  v_owner uuid;
  v_secret text;
  v_ok_secret boolean := false;
begin
  if not exists (select 1 from public.devices d where d.id = p_device_id) then
    return;
  end if;

  select d.registered_session_id, d.owner_id
  into v_reg, v_owner
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
  set status = 'offline'
  where d.id = p_device_id
    and d.status <> 'pending_pairing';
end;
$$;

revoke all on function public.tv_device_offline(uuid, text) from public;
grant execute on function public.tv_device_offline(uuid, text) to anon, authenticated;
