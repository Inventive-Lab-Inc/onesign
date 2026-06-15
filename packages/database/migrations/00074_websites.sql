-- Websites: URL, pasted HTML, and uploaded HTML file content for digital signage.

do $$ begin
  create type public.website_source_type as enum ('url', 'html', 'file');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.websites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  source_type public.website_source_type not null default 'url',
  url text,
  html_content text,
  storage_path text,
  playback_url text not null,
  thumbnail_storage_path text,
  thumbnail_status text check (thumbnail_status in ('pending', 'ready', 'failed')),
  description text,
  tags text[] not null default '{}',
  zoom_level integer not null default 100 check (zoom_level >= 25 and zoom_level <= 200),
  display_from timestamptz,
  display_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint websites_name_not_empty check (char_length(trim(name)) > 0),
  constraint websites_source_valid check (
    (source_type = 'url' and url is not null and char_length(trim(url)) > 0)
    or (source_type = 'html' and html_content is not null and char_length(trim(html_content)) > 0)
    or (source_type = 'file' and storage_path is not null and char_length(trim(storage_path)) > 0)
  )
);

create index if not exists websites_owner_id_idx on public.websites (owner_id);
create index if not exists websites_tags_gin_idx on public.websites using gin (tags);

alter table public.websites enable row level security;

drop policy if exists websites_select on public.websites;
create policy websites_select on public.websites
  for select using (auth.uid() = owner_id or public.is_platform_admin());

drop policy if exists websites_insert on public.websites;
create policy websites_insert on public.websites
  for insert with check (auth.uid() = owner_id or public.is_platform_admin());

drop policy if exists websites_update on public.websites;
create policy websites_update on public.websites
  for update using (auth.uid() = owner_id or public.is_platform_admin());

drop policy if exists websites_delete on public.websites;
create policy websites_delete on public.websites
  for delete using (auth.uid() = owner_id or public.is_platform_admin());

-- Playlist items may reference media OR a website (never both).
alter table public.playlist_items
  alter column media_id drop not null;

alter table public.playlist_items
  add column if not exists website_id uuid references public.websites (id) on delete restrict;

create index if not exists playlist_items_website_id_idx on public.playlist_items (website_id);

alter table public.playlist_items
  drop constraint if exists playlist_items_content_check;

alter table public.playlist_items
  add constraint playlist_items_content_check check (
    (media_id is not null and website_id is null)
    or (media_id is null and website_id is not null)
  );

comment on table public.websites is
  'Web-based signage content: external URLs, pasted HTML, or uploaded HTML files.';
comment on column public.websites.playback_url is
  'Absolute URL the TV player loads (external URL, hosted HTML page, or file CDN URL).';

alter publication supabase_realtime add table public.websites;

-- Public read for TV display pages (HTML paste content only).
create or replace function public.tv_get_website_html(p_website_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.websites%rowtype;
begin
  select * into v_row
  from public.websites w
  where w.id = p_website_id
    and w.source_type = 'html';

  if not found then
    return jsonb_build_object('ok', to_jsonb(false));
  end if;

  return jsonb_build_object(
    'ok', to_jsonb(true),
    'html', to_jsonb(v_row.html_content),
    'zoomLevel', to_jsonb(v_row.zoom_level)
  );
end;
$$;

revoke all on function public.tv_get_website_html(uuid) from public;
grant execute on function public.tv_get_website_html(uuid) to anon, authenticated;

-- Extend playback revision hash to include website slides.
create or replace function public.tv_get_playback_revision(p_device_id uuid, p_playback_secret text default null)
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
  v_screen_orientation text := 'landscape';
  v_screenshot_requested_at timestamptz;
  v_secret text;
  v_ok_secret boolean := false;
  v_ok_jwt boolean := false;
  v_playlist_id uuid;
  v_dp_updated timestamptz;
  v_playlist_name text;
  v_transition_style text := 'none';
  v_shuffle_enabled boolean := false;
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
    d.screen_orientation,
    d.screenshot_requested_at
  into
    v_reg,
    v_owner,
    v_device_name,
    v_playback_disabled,
    v_screen_orientation,
    v_screenshot_requested_at
  from public.devices d
  where d.id = p_device_id;

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
      'contentRevision', to_jsonb(v_content_hash),
      'playlistId', to_jsonb(null::uuid),
      'playlistName', to_jsonb(null::text),
      'screenOrientation', to_jsonb(v_screen_orientation),
      'screenshotRequestedAt', to_jsonb(v_screenshot_requested_at)
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
      'contentRevision', to_jsonb(null::text),
      'playlistId', to_jsonb(null::uuid),
      'playlistName', to_jsonb(null::text),
      'screenOrientation', to_jsonb(v_screen_orientation),
      'screenshotRequestedAt', to_jsonb(v_screenshot_requested_at)
    );
  end if;

  select p.name, p.transition_style, p.shuffle_enabled
  into v_playlist_name, v_transition_style, v_shuffle_enabled
  from public.playlists p
  where p.id = v_playlist_id;

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
        || '|'
        || coalesce((
            select string_agg(
              pi.id::text
              || ':' || pi.sort_order::text
              || ':' || coalesce(pi.duration_seconds::text, 'n')
              || ':' || coalesce(m.storage_path, w.playback_url, ''),
              '>' order by pi.sort_order asc, pi.id asc
            )
            from public.playlist_items pi
            left join public.media m on m.id = pi.media_id
            left join public.websites w on w.id = pi.website_id
            where pi.playlist_id = v_playlist_id
              and (
                (pi.media_id is not null and m.storage_path is not null and length(trim(m.storage_path)) > 0)
                or (pi.website_id is not null and w.playback_url is not null and length(trim(w.playback_url)) > 0)
              )
        ), '')
      ),
      ''
    )
  into v_content_hash;

  return jsonb_build_object(
    'ok', to_jsonb(true),
    'deviceName', to_jsonb(v_device_name),
    'playbackDisabled', to_jsonb(false),
    'contentRevision', to_jsonb(v_content_hash),
    'playlistId', to_jsonb(v_playlist_id),
    'playlistName', to_jsonb(v_playlist_name),
    'screenOrientation', to_jsonb(v_screen_orientation),
    'screenshotRequestedAt', to_jsonb(v_screenshot_requested_at)
  );
end;
$$;

-- Extend playback slides to include website items.
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
  v_slides jsonb;
  v_content_hash text;
begin
  if not exists (select 1 from public.devices d where d.id = p_device_id) then
    return jsonb_build_object('ok', to_jsonb(false));
  end if;

  select d.registered_session_id, d.owner_id, d.name, d.playback_disabled
  into v_reg, v_owner, v_device_name, v_playback_disabled
  from public.devices d
  where d.id = p_device_id;

  v_playback_disabled := public.device_effective_playback_disabled(p_device_id);

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
  ) combined;

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
              || ':' || coalesce(m.storage_path, w.playback_url, ''),
              '>' order by pi.sort_order asc, pi.id asc
            )
            from public.playlist_items pi
            left join public.media m on m.id = pi.media_id
            left join public.websites w on w.id = pi.website_id
            where pi.playlist_id = v_playlist_id
              and (
                (pi.media_id is not null and m.storage_path is not null and length(trim(m.storage_path)) > 0)
                or (pi.website_id is not null and w.playback_url is not null and length(trim(w.playback_url)) > 0)
              )
        ), '')
      ),
      ''
    )
  into v_content_hash;

  return jsonb_build_object(
    'ok', to_jsonb(true),
    'deviceName', to_jsonb(v_device_name),
    'playbackDisabled', to_jsonb(false),
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

revoke all on function public.tv_get_playback_revision(uuid, text) from public;
grant execute on function public.tv_get_playback_revision(uuid, text) to anon, authenticated;
revoke all on function public.tv_get_playback_slides(uuid, text) from public;
grant execute on function public.tv_get_playback_slides(uuid, text) to anon, authenticated;
