-- Screen playlists created before workspace scoping omitted workspace_id on the
-- parent playlist row, so playlist_items inserts failed workspace RLS.
-- Backfill from the linked device, and allow change_playlists (screen editors)
-- in addition to manage_content for playlist item writes.

update public.playlists p
set workspace_id = d.workspace_id
from public.device_playlists dp
join public.devices d on d.id = dp.device_id
where dp.playlist_id = p.id
  and dp.is_active = true
  and p.workspace_id is null
  and d.workspace_id is not null;

drop policy if exists playlist_items_insert_workspace on public.playlist_items;
create policy playlist_items_insert_workspace on public.playlist_items
  for insert with check (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_items.playlist_id
        and p.workspace_id is not null
        and (
          public.workspace_has_permission(p.workspace_id, 'manage_content')
          or public.workspace_has_permission(p.workspace_id, 'change_playlists')
        )
        and public.is_workspace_account_active(p.workspace_id)
    )
  );

drop policy if exists playlist_items_update_workspace on public.playlist_items;
create policy playlist_items_update_workspace on public.playlist_items
  for update using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_items.playlist_id
        and p.workspace_id is not null
        and (
          public.workspace_has_permission(p.workspace_id, 'manage_content')
          or public.workspace_has_permission(p.workspace_id, 'change_playlists')
        )
        and public.is_workspace_account_active(p.workspace_id)
    )
  );

drop policy if exists playlist_items_delete_workspace on public.playlist_items;
create policy playlist_items_delete_workspace on public.playlist_items
  for delete using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_items.playlist_id
        and p.workspace_id is not null
        and (
          public.workspace_has_permission(p.workspace_id, 'manage_content')
          or public.workspace_has_permission(p.workspace_id, 'change_playlists')
        )
        and public.is_workspace_account_active(p.workspace_id)
    )
  );
