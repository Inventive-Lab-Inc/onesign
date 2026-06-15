-- Fix nested folder inserts: parent lookup must bypass RLS (same-table subquery in WITH CHECK).
-- Align media_groups write policies with media/playlists (account active + staff writer).

create or replace function public.media_group_parent_is_valid(
  p_parent_id uuid,
  p_owner_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_parent_id is null
    or exists (
      select 1
        from public.media_groups g
       where g.id = p_parent_id
         and g.owner_id = p_owner_id
    );
$$;

revoke all on function public.media_group_parent_is_valid(uuid, uuid) from public;
grant execute on function public.media_group_parent_is_valid(uuid, uuid) to authenticated;

drop policy if exists media_groups_select on public.media_groups;
create policy media_groups_select on public.media_groups
  for select using (auth.uid() = owner_id or public.is_platform_staff());

drop policy if exists media_groups_insert on public.media_groups;
create policy media_groups_insert on public.media_groups
  for insert with check (
    (
      (auth.uid() = owner_id and public.is_account_active())
      or public.is_platform_staff_writer()
    )
    and public.media_group_parent_is_valid(parent_id, owner_id)
  );

drop policy if exists media_groups_update on public.media_groups;
create policy media_groups_update on public.media_groups
  for update using (
    (auth.uid() = owner_id and public.is_account_active())
    or public.is_platform_staff_writer()
  );

drop policy if exists media_groups_delete on public.media_groups;
create policy media_groups_delete on public.media_groups
  for delete using (
    (auth.uid() = owner_id and public.is_account_active())
    or public.is_platform_staff_writer()
  );
