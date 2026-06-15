-- Nested media folders: optional parent folder per group.

alter table public.media_groups
  add column if not exists parent_id uuid references public.media_groups (id) on delete cascade;

create index if not exists media_groups_parent_id_idx on public.media_groups (parent_id);

drop policy if exists media_groups_insert on public.media_groups;
create policy media_groups_insert on public.media_groups
  for insert with check (
    (auth.uid() = owner_id or public.is_platform_admin())
    and (
      parent_id is null
      or exists (
        select 1
        from public.media_groups p
        where p.id = parent_id
          and p.owner_id = owner_id
      )
    )
  );
