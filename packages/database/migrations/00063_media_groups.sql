-- Media groups: organize library files into named folders per account.

create table if not exists public.media_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  accent_color text,
  created_at timestamptz not null default now(),
  constraint media_groups_name_not_empty check (char_length(trim(name)) > 0)
);

create index if not exists media_groups_owner_id_idx on public.media_groups (owner_id);

create table if not exists public.media_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.media_groups (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint media_group_members_unique unique (group_id, media_id)
);

create index if not exists media_group_members_group_id_idx on public.media_group_members (group_id);
create index if not exists media_group_members_media_id_idx on public.media_group_members (media_id);

alter table public.media_groups enable row level security;
alter table public.media_group_members enable row level security;

drop policy if exists media_groups_select on public.media_groups;
create policy media_groups_select on public.media_groups
  for select using (auth.uid() = owner_id or public.is_platform_admin());

drop policy if exists media_groups_insert on public.media_groups;
create policy media_groups_insert on public.media_groups
  for insert with check (auth.uid() = owner_id or public.is_platform_admin());

drop policy if exists media_groups_update on public.media_groups;
create policy media_groups_update on public.media_groups
  for update using (auth.uid() = owner_id or public.is_platform_admin());

drop policy if exists media_groups_delete on public.media_groups;
create policy media_groups_delete on public.media_groups
  for delete using (auth.uid() = owner_id or public.is_platform_admin());

drop policy if exists media_group_members_select on public.media_group_members;
create policy media_group_members_select on public.media_group_members
  for select using (
    exists (
      select 1
      from public.media_groups g
      where g.id = group_id
        and (g.owner_id = auth.uid() or public.is_platform_admin())
    )
  );

drop policy if exists media_group_members_insert on public.media_group_members;
create policy media_group_members_insert on public.media_group_members
  for insert with check (
    exists (
      select 1
      from public.media_groups g
      join public.media m on m.id = media_id
      where g.id = group_id
        and m.owner_id = g.owner_id
        and (g.owner_id = auth.uid() or public.is_platform_admin())
    )
  );

drop policy if exists media_group_members_delete on public.media_group_members;
create policy media_group_members_delete on public.media_group_members
  for delete using (
    exists (
      select 1
      from public.media_groups g
      where g.id = group_id
        and (g.owner_id = auth.uid() or public.is_platform_admin())
    )
  );

alter publication supabase_realtime add table public.media_groups;
alter publication supabase_realtime add table public.media_group_members;
