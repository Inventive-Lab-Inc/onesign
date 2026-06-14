-- Device groups: organize screens into named collections per account.

create table if not exists public.device_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  accent_color text,
  created_at timestamptz not null default now(),
  constraint device_groups_name_not_empty check (char_length(trim(name)) > 0)
);

create index if not exists device_groups_owner_id_idx on public.device_groups (owner_id);

create table if not exists public.device_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.device_groups (id) on delete cascade,
  device_id uuid not null references public.devices (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint device_group_members_unique unique (group_id, device_id)
);

create index if not exists device_group_members_group_id_idx on public.device_group_members (group_id);
create index if not exists device_group_members_device_id_idx on public.device_group_members (device_id);

alter table public.device_groups enable row level security;
alter table public.device_group_members enable row level security;

-- Groups: owner CRUD + platform admin
drop policy if exists device_groups_select on public.device_groups;
create policy device_groups_select on public.device_groups
  for select using (auth.uid() = owner_id or public.is_platform_admin());

drop policy if exists device_groups_insert on public.device_groups;
create policy device_groups_insert on public.device_groups
  for insert with check (auth.uid() = owner_id or public.is_platform_admin());

drop policy if exists device_groups_update on public.device_groups;
create policy device_groups_update on public.device_groups
  for update using (auth.uid() = owner_id or public.is_platform_admin());

drop policy if exists device_groups_delete on public.device_groups;
create policy device_groups_delete on public.device_groups
  for delete using (auth.uid() = owner_id or public.is_platform_admin());

-- Members: owner of group + device, or platform admin
drop policy if exists device_group_members_select on public.device_group_members;
create policy device_group_members_select on public.device_group_members
  for select using (
    exists (
      select 1
      from public.device_groups g
      where g.id = group_id
        and (g.owner_id = auth.uid() or public.is_platform_admin())
    )
  );

drop policy if exists device_group_members_insert on public.device_group_members;
create policy device_group_members_insert on public.device_group_members
  for insert with check (
    exists (
      select 1
      from public.device_groups g
      join public.devices d on d.id = device_id
      where g.id = group_id
        and d.owner_id = g.owner_id
        and (g.owner_id = auth.uid() or public.is_platform_admin())
    )
  );

drop policy if exists device_group_members_delete on public.device_group_members;
create policy device_group_members_delete on public.device_group_members
  for delete using (
    exists (
      select 1
      from public.device_groups g
      where g.id = group_id
        and (g.owner_id = auth.uid() or public.is_platform_admin())
    )
  );

alter publication supabase_realtime add table public.device_groups;
alter publication supabase_realtime add table public.device_group_members;
