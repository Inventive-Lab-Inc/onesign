-- Device groups share one playlist across all assigned screens.

alter table public.device_groups
  add column if not exists playlist_id uuid references public.playlists (id) on delete set null;

create index if not exists device_groups_playlist_id_idx on public.device_groups (playlist_id);
