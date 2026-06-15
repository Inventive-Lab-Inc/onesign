-- Support all four TV playback orientations (matches Android ActivityInfo + AbleSign).

do $$
begin
  if exists (select 1 from pg_type where typname = 'device_screen_orientation') then
    alter type public.device_screen_orientation add value if not exists 'reverse_landscape';
    alter type public.device_screen_orientation add value if not exists 'reverse_portrait';
  end if;
end $$;

alter table public.devices
  drop constraint if exists devices_screen_orientation_check;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'devices'
      and column_name = 'screen_orientation'
      and data_type = 'text'
  ) then
    alter table public.devices
      add constraint devices_screen_orientation_check
      check (screen_orientation in ('landscape', 'portrait', 'reverse_landscape', 'reverse_portrait'));
  end if;
end $$;

comment on column public.devices.screen_orientation is
  'Preferred playback orientation: landscape, portrait (+90), reverse_landscape (+180), reverse_portrait (+270).';
