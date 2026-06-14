-- Playlist groups: organize playlists into named collections per account.

create table if not exists public.playlist_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  accent_color text,
  created_at timestamptz not null default now(),
  constraint playlist_groups_name_not_empty check (char_length(trim(name)) > 0)
);

create index if not exists playlist_groups_owner_id_idx on public.playlist_groups (owner_id);

create table if not exists public.playlist_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.playlist_groups (id) on delete cascade,
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint playlist_group_members_unique unique (group_id, playlist_id)
);

create index if not exists playlist_group_members_group_id_idx on public.playlist_group_members (group_id);
create index if not exists playlist_group_members_playlist_id_idx on public.playlist_group_members (playlist_id);

alter table public.playlist_groups enable row level security;
alter table public.playlist_group_members enable row level security;

drop policy if exists playlist_groups_select on public.playlist_groups;
create policy playlist_groups_select on public.playlist_groups
  for select using (auth.uid() = owner_id or public.is_platform_admin());

drop policy if exists playlist_groups_insert on public.playlist_groups;
create policy playlist_groups_insert on public.playlist_groups
  for insert with check (auth.uid() = owner_id or public.is_platform_admin());

drop policy if exists playlist_groups_update on public.playlist_groups;
create policy playlist_groups_update on public.playlist_groups
  for update using (auth.uid() = owner_id or public.is_platform_admin());

drop policy if exists playlist_groups_delete on public.playlist_groups;
create policy playlist_groups_delete on public.playlist_groups
  for delete using (auth.uid() = owner_id or public.is_platform_admin());

drop policy if exists playlist_group_members_select on public.playlist_group_members;
create policy playlist_group_members_select on public.playlist_group_members
  for select using (
    exists (
      select 1
      from public.playlist_groups g
      where g.id = group_id
        and (g.owner_id = auth.uid() or public.is_platform_admin())
    )
  );

drop policy if exists playlist_group_members_insert on public.playlist_group_members;
create policy playlist_group_members_insert on public.playlist_group_members
  for insert with check (
    exists (
      select 1
      from public.playlist_groups g
      join public.playlists p on p.id = playlist_id
      where g.id = group_id
        and p.owner_id = g.owner_id
        and (g.owner_id = auth.uid() or public.is_platform_admin())
    )
  );

drop policy if exists playlist_group_members_delete on public.playlist_group_members;
create policy playlist_group_members_delete on public.playlist_group_members
  for delete using (
    exists (
      select 1
      from public.playlist_groups g
      where g.id = group_id
        and (g.owner_id = auth.uid() or public.is_platform_admin())
    )
  );

alter publication supabase_realtime add table public.playlist_groups;
alter publication supabase_realtime add table public.playlist_group_members;
