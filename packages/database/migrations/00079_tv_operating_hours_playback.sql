-- TV playback: enforce screen operating hours + per-item daily windows; expose schedule to players.

create or replace function public.tv_get_playback_slides(p_device_id uuid, p_playback_secret text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_reg uuid;
  v_owner uuid;
  v_device_name text;
  v_playback_disabled boolean := false;
  v_secret text;
  v_ok_secret boolean := false;
  v_ok_jwt boolean := false;
  v_playlist_id uuid;
  v_dp_updated timestamptz;
  v_playlist_name text;
  v_transition_style text := 'none';
  v_shuffle_enabled boolean := false;
  v_operating_hours jsonb;
  v_operating_hours_timezone text := 'UTC';
  v_blank_when_off_hours boolean := false;
  v_in_operating_hours boolean := true;
  v_slides jsonb;
  v_content_hash text;
begin
  if not exists (select 1 from public.devices d where d.id = p_device_id) then
    return jsonb_build_object('ok', to_jsonb(false));
  end if;

  select
    d.registered_session_id,
    d.owner_id,
    d.name,
    d.playback_disabled,
    d.operating_hours,
    d.operating_hours_timezone,
    d.blank_when_off_hours
  into
    v_reg,
    v_owner,
    v_device_name,
    v_playback_disabled,
    v_operating_hours,
    v_operating_hours_timezone,
    v_blank_when_off_hours
  from public.devices d
  where d.id = p_device_id;

  v_playback_disabled := public.device_effective_playback_disabled(p_device_id);
  v_in_operating_hours := public.device_is_in_operating_hours(
    v_operating_hours,
    v_operating_hours_timezone,
    now()
  );

  select c.secret
  into v_secret
  from public.device_playback_credentials c
  where c.device_id = p_device_id;

  if v_owner is not null
     and v_secret is null
     and auth.uid() is not null
     and v_reg is not distinct from auth.uid() then
    v_secret := lower(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''));
    insert into public.device_playback_credentials (device_id, secret)
    values (p_device_id, v_secret);
  end if;

  if p_playback_secret is not null
     and trim(p_playback_secret) <> ''
     and v_secret is not null
     and trim(v_secret) <> ''
     and v_secret = p_playback_secret then
    v_ok_secret := true;
  end if;

  if not v_ok_secret then
    if auth.uid() is null then
      return jsonb_build_object('ok', to_jsonb(false));
    end if;
    if v_reg is null or v_reg is distinct from auth.uid() then
      return jsonb_build_object('ok', to_jsonb(false));
    end if;
    v_ok_jwt := true;
  end if;

  if v_playback_disabled then
    v_content_hash := md5('playback_disabled|' || p_device_id::text);
    return jsonb_build_object(
      'ok', to_jsonb(true),
      'deviceName', to_jsonb(v_device_name),
      'playbackDisabled', to_jsonb(true),
      'outsideOperatingHours', to_jsonb(not v_in_operating_hours),
      'blankWhenOffHours', to_jsonb(v_blank_when_off_hours),
      'operatingHours', coalesce(v_operating_hours, '{}'::jsonb),
      'operatingHoursTimezone', to_jsonb(v_operating_hours_timezone),
      'playbackSecret', case
        when v_ok_jwt and v_secret is not null then to_jsonb(v_secret)
        else 'null'::jsonb
      end,
      'playlistName', to_jsonb(null::text),
      'slides', '[]'::jsonb,
      'contentRevision', to_jsonb(v_content_hash),
      'playlistId', to_jsonb(null::uuid),
      'transitionStyle', to_jsonb('none'),
      'shuffleEnabled', to_jsonb(false)
    );
  end if;

  select dp.playlist_id, dp.updated_at
  into v_playlist_id, v_dp_updated
  from public.device_playlists dp
  where dp.device_id = p_device_id
    and dp.is_active = true
  order by dp.updated_at desc nulls last
  limit 1;

  if v_playlist_id is null then
    return jsonb_build_object(
      'ok', to_jsonb(true),
      'deviceName', to_jsonb(v_device_name),
      'playbackDisabled', to_jsonb(false),
      'outsideOperatingHours', to_jsonb(not v_in_operating_hours),
      'blankWhenOffHours', to_jsonb(v_blank_when_off_hours),
      'operatingHours', coalesce(v_operating_hours, '{}'::jsonb),
      'operatingHoursTimezone', to_jsonb(v_operating_hours_timezone),
      'playbackSecret', case
        when v_ok_jwt and v_secret is not null then to_jsonb(v_secret)
        else 'null'::jsonb
      end,
      'playlistName', to_jsonb(null::text),
      'slides', '[]'::jsonb,
      'contentRevision', to_jsonb(null::text),
      'playlistId', to_jsonb(null::uuid),
      'transitionStyle', to_jsonb('none'),
      'shuffleEnabled', to_jsonb(false)
    );
  end if;

  select p.name, p.transition_style, p.shuffle_enabled
  into v_playlist_name, v_transition_style, v_shuffle_enabled
  from public.playlists p
  where p.id = v_playlist_id;

  if not v_in_operating_hours then
    v_slides := '[]'::jsonb;
  else
    select coalesce(
      jsonb_agg(slide order by sort_order asc, item_id asc),
      '[]'::jsonb
    )
    into v_slides
    from (
      select
        pi.sort_order,
        pi.id as item_id,
        jsonb_build_object(
          'fileType', m.file_type,
          'durationSeconds', public.playback_slide_duration_seconds(
            m.file_type, pi.duration_seconds, m.duration_seconds
          ),
          'storagePath', m.storage_path
        ) as slide
      from public.playlist_items pi
      join public.media m on m.id = pi.media_id
      where pi.playlist_id = v_playlist_id
        and pi.media_id is not null
        and m.storage_path is not null
        and length(trim(m.storage_path)) > 0
        and public.playlist_item_is_active_for_playback(
          pi.display_from,
          pi.display_until,
          pi.daily_schedule_enabled,
          pi.daily_schedule,
          m.display_from,
          m.display_until,
          v_operating_hours_timezone,
          now()
        )

      union all

      select
        pi.sort_order,
        pi.id as item_id,
        jsonb_build_object(
          'fileType', 'website',
          'durationSeconds', coalesce(pi.duration_seconds, 30),
          'storagePath', w.playback_url,
          'zoomLevel', w.zoom_level
        ) as slide
      from public.playlist_items pi
      join public.websites w on w.id = pi.website_id
      where pi.playlist_id = v_playlist_id
        and pi.website_id is not null
        and w.playback_url is not null
        and length(trim(w.playback_url)) > 0
        and public.playlist_item_is_active_for_playback(
          pi.display_from,
          pi.display_until,
          pi.daily_schedule_enabled,
          pi.daily_schedule,
          w.display_from,
          w.display_until,
          v_operating_hours_timezone,
          now()
        )
    ) combined;
  end if;

  if v_slides is null then
    v_slides := '[]'::jsonb;
  end if;

  select
    coalesce(
      md5(
        v_playlist_id::text
        || '|'
        || coalesce(v_dp_updated::text, '')
        || '|'
        || coalesce(v_transition_style, 'none')
        || '|'
        || coalesce(v_shuffle_enabled::text, 'false')
        || '|hours|'
        || coalesce(v_in_operating_hours::text, 'true')
        || '|'
        || coalesce(v_operating_hours::text, '')
        || '|'
        || coalesce(v_operating_hours_timezone, 'UTC')
        || '|'
        || coalesce((
            select string_agg(
              pi.id::text
              || ':' || pi.sort_order::text
              || ':' || coalesce(
                public.playback_slide_duration_label(
                  m.file_type, pi.duration_seconds, m.duration_seconds
                ),
                coalesce(pi.duration_seconds::text, '30')
              )
              || ':' || coalesce(m.storage_path, w.playback_url, '')
              || ':' || coalesce(w.zoom_level::text, '')
              || ':' || coalesce(m.display_from::text, w.display_from::text, '')
              || ':' || coalesce(m.display_until::text, w.display_until::text, '')
              || ':' || coalesce(pi.daily_schedule_enabled::text, 'false')
              || ':' || coalesce(pi.daily_schedule::text, ''),
              '>' order by pi.sort_order asc, pi.id asc
            )
            from public.playlist_items pi
            left join public.media m on m.id = pi.media_id
            left join public.websites w on w.id = pi.website_id
            where pi.playlist_id = v_playlist_id
              and (
                (
                  pi.media_id is not null
                  and m.storage_path is not null
                  and length(trim(m.storage_path)) > 0
                )
                or (
                  pi.website_id is not null
                  and w.playback_url is not null
                  and length(trim(w.playback_url)) > 0
                )
              )
        ), '')
        || '|active|'
        || case when not v_in_operating_hours then '' else coalesce((
            select string_agg(
              pi.id::text
              || ':' || pi.sort_order::text
              || ':' || coalesce(
                public.playback_slide_duration_label(
                  m.file_type, pi.duration_seconds, m.duration_seconds
                ),
                coalesce(pi.duration_seconds::text, '30')
              )
              || ':' || coalesce(m.storage_path, w.playback_url, '')
              || ':' || coalesce(w.zoom_level::text, ''),
              '>' order by pi.sort_order asc, pi.id asc
            )
            from public.playlist_items pi
            left join public.media m on m.id = pi.media_id
            left join public.websites w on w.id = pi.website_id
            where pi.playlist_id = v_playlist_id
              and (
                (
                  pi.media_id is not null
                  and m.storage_path is not null
                  and length(trim(m.storage_path)) > 0
                  and public.playlist_item_is_active_for_playback(
                    pi.display_from, pi.display_until,
                    pi.daily_schedule_enabled, pi.daily_schedule,
                    m.display_from, m.display_until,
                    v_operating_hours_timezone, now()
                  )
                )
                or (
                  pi.website_id is not null
                  and w.playback_url is not null
                  and length(trim(w.playback_url)) > 0
                  and public.playlist_item_is_active_for_playback(
                    pi.display_from, pi.display_until,
                    pi.daily_schedule_enabled, pi.daily_schedule,
                    w.display_from, w.display_until,
                    v_operating_hours_timezone, now()
                  )
                )
              )
        ), '') end
      ),
      ''
    )
  into v_content_hash;

  return jsonb_build_object(
    'ok', to_jsonb(true),
    'deviceName', to_jsonb(v_device_name),
    'playbackDisabled', to_jsonb(false),
    'outsideOperatingHours', to_jsonb(not v_in_operating_hours),
    'blankWhenOffHours', to_jsonb(v_blank_when_off_hours),
    'operatingHours', coalesce(v_operating_hours, '{}'::jsonb),
    'operatingHoursTimezone', to_jsonb(v_operating_hours_timezone),
    'playbackSecret', case
      when v_ok_jwt and v_secret is not null then to_jsonb(v_secret)
      else 'null'::jsonb
    end,
    'playlistName', to_jsonb(v_playlist_name),
    'contentRevision', to_jsonb(v_content_hash),
    'playlistId', to_jsonb(v_playlist_id),
    'transitionStyle', to_jsonb(v_transition_style),
    'shuffleEnabled', to_jsonb(v_shuffle_enabled),
    'slides', v_slides
  );
end;
$$;

revoke all on function public.tv_get_playback_slides(uuid, text) from public;
grant execute on function public.tv_get_playback_slides(uuid, text) to anon, authenticated;
