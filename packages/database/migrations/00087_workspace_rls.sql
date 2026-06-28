-- Workspace membership-aware RLS (Phase 2).
--
-- Adds permission helpers and ADDITIVE permissive policies so that workspace
-- members (not just the account owner) can access content scoped to workspaces
-- they belong to. Existing owner / TV-session / platform-staff policies are
-- left intact; RLS policies are OR'd, so:
--   * account owner  -> still matches via auth.uid() = owner_id
--   * TV session     -> still matches via registered_session_id
--   * platform staff -> still matches via is_platform_staff()
--   * invited member -> matches via the new workspace_has_permission() policies

-- ---------------------------------------------------------------------------
-- Permission helpers
-- ---------------------------------------------------------------------------

-- Pure role -> permission resolver. Mirrors resolveWorkspacePermissions() in
-- @signage/types. Keep the two in sync.
create or replace function public.workspace_permission_granted(
  p_role text,
  p_permissions text[],
  p_permission text
)
returns boolean
language sql
immutable
as $$
  select case
    when p_role in ('owner', 'account_admin') then true
    when p_role = 'admin' then p_permission <> 'access_billing'
    when p_role = 'standard' then p_permission in (
      'view_screens', 'manage_screens', 'change_playlists',
      'view_content', 'manage_content', 'view_websites', 'manage_websites'
    )
    when p_role = 'content_manager' then p_permission in (
      'view_content', 'manage_content', 'view_websites', 'manage_websites', 'change_playlists'
    )
    when p_role = 'custom' then p_permission = any(coalesce(p_permissions, '{}'::text[]))
    else false
  end;
$$;

-- True when the current user holds p_permission in the given workspace.
create or replace function public.workspace_has_permission(p_workspace_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and public.workspace_permission_granted(wm.role, wm.permissions, p_permission)
  );
$$;

revoke all on function public.workspace_has_permission(uuid, text) from public;
grant execute on function public.workspace_has_permission(uuid, text) to authenticated;

-- Account active by id (suspension gate keyed on the account owner, not the member).
create or replace function public.is_account_active_by_id(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select not p.is_disabled from public.profiles p where p.id = p_account_id),
    true
  );
$$;

revoke all on function public.is_account_active_by_id(uuid) from public;
grant execute on function public.is_account_active_by_id(uuid) to authenticated;

-- Account active for a workspace (looks up the workspace's account owner).
create or replace function public.is_workspace_account_active(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_account_active_by_id((
    select w.account_id from public.workspaces w where w.id = p_workspace_id
  ));
$$;

revoke all on function public.is_workspace_account_active(uuid) from public;
grant execute on function public.is_workspace_account_active(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Devices  (screens domain: view_screens / manage_screens)
-- ---------------------------------------------------------------------------
drop policy if exists devices_select_workspace on public.devices;
create policy devices_select_workspace on public.devices
  for select using (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'view_screens')
  );

drop policy if exists devices_update_workspace on public.devices;
create policy devices_update_workspace on public.devices
  for update using (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'manage_screens')
    and public.is_workspace_account_active(workspace_id)
  )
  with check (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'manage_screens')
    and public.is_workspace_account_active(workspace_id)
  );

drop policy if exists devices_delete_workspace on public.devices;
create policy devices_delete_workspace on public.devices
  for delete using (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'manage_screens')
    and public.is_workspace_account_active(workspace_id)
  );

-- ---------------------------------------------------------------------------
-- Media  (content domain: view_content / manage_content)
-- ---------------------------------------------------------------------------
drop policy if exists media_select_workspace on public.media;
create policy media_select_workspace on public.media
  for select using (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'view_content')
  );

drop policy if exists media_insert_workspace on public.media;
create policy media_insert_workspace on public.media
  for insert with check (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'manage_content')
    and public.is_workspace_account_active(workspace_id)
  );

drop policy if exists media_update_workspace on public.media;
create policy media_update_workspace on public.media
  for update using (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'manage_content')
    and public.is_workspace_account_active(workspace_id)
  )
  with check (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'manage_content')
    and public.is_workspace_account_active(workspace_id)
  );

drop policy if exists media_delete_workspace on public.media;
create policy media_delete_workspace on public.media
  for delete using (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'manage_content')
    and public.is_workspace_account_active(workspace_id)
  );

-- ---------------------------------------------------------------------------
-- Playlists  (visible to content and screen viewers; edited with manage_content)
-- ---------------------------------------------------------------------------
drop policy if exists playlists_select_workspace on public.playlists;
create policy playlists_select_workspace on public.playlists
  for select using (
    workspace_id is not null
    and (
      public.workspace_has_permission(workspace_id, 'view_content')
      or public.workspace_has_permission(workspace_id, 'view_screens')
    )
  );

drop policy if exists playlists_insert_workspace on public.playlists;
create policy playlists_insert_workspace on public.playlists
  for insert with check (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'manage_content')
    and public.is_workspace_account_active(workspace_id)
  );

drop policy if exists playlists_update_workspace on public.playlists;
create policy playlists_update_workspace on public.playlists
  for update using (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'manage_content')
    and public.is_workspace_account_active(workspace_id)
  )
  with check (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'manage_content')
    and public.is_workspace_account_active(workspace_id)
  );

drop policy if exists playlists_delete_workspace on public.playlists;
create policy playlists_delete_workspace on public.playlists
  for delete using (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'manage_content')
    and public.is_workspace_account_active(workspace_id)
  );

-- ---------------------------------------------------------------------------
-- Playlist items  (scoped through the parent playlist's workspace)
-- ---------------------------------------------------------------------------
drop policy if exists playlist_items_select_workspace on public.playlist_items;
create policy playlist_items_select_workspace on public.playlist_items
  for select using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_items.playlist_id
        and p.workspace_id is not null
        and (
          public.workspace_has_permission(p.workspace_id, 'view_content')
          or public.workspace_has_permission(p.workspace_id, 'view_screens')
        )
    )
  );

drop policy if exists playlist_items_insert_workspace on public.playlist_items;
create policy playlist_items_insert_workspace on public.playlist_items
  for insert with check (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_items.playlist_id
        and p.workspace_id is not null
        and public.workspace_has_permission(p.workspace_id, 'manage_content')
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
        and public.workspace_has_permission(p.workspace_id, 'manage_content')
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
        and public.workspace_has_permission(p.workspace_id, 'manage_content')
        and public.is_workspace_account_active(p.workspace_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Device playlists  (assignment: change_playlists on the device's workspace)
-- ---------------------------------------------------------------------------
drop policy if exists device_playlists_select_workspace on public.device_playlists;
create policy device_playlists_select_workspace on public.device_playlists
  for select using (
    exists (
      select 1 from public.devices d
      where d.id = device_playlists.device_id
        and d.workspace_id is not null
        and public.workspace_has_permission(d.workspace_id, 'view_screens')
    )
  );

drop policy if exists device_playlists_insert_workspace on public.device_playlists;
create policy device_playlists_insert_workspace on public.device_playlists
  for insert with check (
    exists (
      select 1
      from public.devices d
      join public.playlists p on p.id = device_playlists.playlist_id
      where d.id = device_playlists.device_id
        and d.workspace_id is not null
        and d.workspace_id = p.workspace_id
        and public.workspace_has_permission(d.workspace_id, 'change_playlists')
        and public.is_workspace_account_active(d.workspace_id)
    )
  );

drop policy if exists device_playlists_update_workspace on public.device_playlists;
create policy device_playlists_update_workspace on public.device_playlists
  for update using (
    exists (
      select 1 from public.devices d
      where d.id = device_playlists.device_id
        and d.workspace_id is not null
        and public.workspace_has_permission(d.workspace_id, 'change_playlists')
        and public.is_workspace_account_active(d.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.devices d
      where d.id = device_playlists.device_id
        and d.workspace_id is not null
        and public.workspace_has_permission(d.workspace_id, 'change_playlists')
        and public.is_workspace_account_active(d.workspace_id)
    )
  );

drop policy if exists device_playlists_delete_workspace on public.device_playlists;
create policy device_playlists_delete_workspace on public.device_playlists
  for delete using (
    exists (
      select 1 from public.devices d
      where d.id = device_playlists.device_id
        and d.workspace_id is not null
        and public.workspace_has_permission(d.workspace_id, 'change_playlists')
        and public.is_workspace_account_active(d.workspace_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Websites  (websites domain: view_websites / manage_websites)
-- ---------------------------------------------------------------------------
drop policy if exists websites_select_workspace on public.websites;
create policy websites_select_workspace on public.websites
  for select using (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'view_websites')
  );

drop policy if exists websites_insert_workspace on public.websites;
create policy websites_insert_workspace on public.websites
  for insert with check (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'manage_websites')
    and public.is_workspace_account_active(workspace_id)
  );

drop policy if exists websites_update_workspace on public.websites;
create policy websites_update_workspace on public.websites
  for update using (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'manage_websites')
    and public.is_workspace_account_active(workspace_id)
  )
  with check (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'manage_websites')
    and public.is_workspace_account_active(workspace_id)
  );

drop policy if exists websites_delete_workspace on public.websites;
create policy websites_delete_workspace on public.websites
  for delete using (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'manage_websites')
    and public.is_workspace_account_active(workspace_id)
  );

-- ---------------------------------------------------------------------------
-- Device groups  (screens domain)
-- ---------------------------------------------------------------------------
drop policy if exists device_groups_select_workspace on public.device_groups;
create policy device_groups_select_workspace on public.device_groups
  for select using (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'view_screens')
  );

drop policy if exists device_groups_write_workspace on public.device_groups;
create policy device_groups_write_workspace on public.device_groups
  for all using (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'manage_screens')
    and public.is_workspace_account_active(workspace_id)
  )
  with check (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'manage_screens')
    and public.is_workspace_account_active(workspace_id)
  );

-- ---------------------------------------------------------------------------
-- Media groups & playlist groups  (content domain)
-- ---------------------------------------------------------------------------
drop policy if exists media_groups_select_workspace on public.media_groups;
create policy media_groups_select_workspace on public.media_groups
  for select using (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'view_content')
  );

drop policy if exists media_groups_write_workspace on public.media_groups;
create policy media_groups_write_workspace on public.media_groups
  for all using (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'manage_content')
    and public.is_workspace_account_active(workspace_id)
  )
  with check (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'manage_content')
    and public.is_workspace_account_active(workspace_id)
  );

drop policy if exists playlist_groups_select_workspace on public.playlist_groups;
create policy playlist_groups_select_workspace on public.playlist_groups
  for select using (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'view_content')
  );

drop policy if exists playlist_groups_write_workspace on public.playlist_groups;
create policy playlist_groups_write_workspace on public.playlist_groups
  for all using (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'manage_content')
    and public.is_workspace_account_active(workspace_id)
  )
  with check (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'manage_content')
    and public.is_workspace_account_active(workspace_id)
  );

-- ---------------------------------------------------------------------------
-- Group membership tables (device_group_members, media_group_members,
-- playlist_group_members) — scoped through their parent group's workspace.
-- These join tables have their own RLS from earlier migrations; we add member
-- access keyed on the parent group's workspace permission.
-- ---------------------------------------------------------------------------
drop policy if exists device_group_members_workspace on public.device_group_members;
create policy device_group_members_workspace on public.device_group_members
  for all using (
    exists (
      select 1 from public.device_groups g
      where g.id = device_group_members.group_id
        and g.workspace_id is not null
        and public.workspace_has_permission(g.workspace_id, 'view_screens')
    )
  )
  with check (
    exists (
      select 1 from public.device_groups g
      where g.id = device_group_members.group_id
        and g.workspace_id is not null
        and public.workspace_has_permission(g.workspace_id, 'manage_screens')
        and public.is_workspace_account_active(g.workspace_id)
    )
  );

drop policy if exists media_group_members_workspace on public.media_group_members;
create policy media_group_members_workspace on public.media_group_members
  for all using (
    exists (
      select 1 from public.media_groups g
      where g.id = media_group_members.group_id
        and g.workspace_id is not null
        and public.workspace_has_permission(g.workspace_id, 'view_content')
    )
  )
  with check (
    exists (
      select 1 from public.media_groups g
      where g.id = media_group_members.group_id
        and g.workspace_id is not null
        and public.workspace_has_permission(g.workspace_id, 'manage_content')
        and public.is_workspace_account_active(g.workspace_id)
    )
  );

drop policy if exists playlist_group_members_workspace on public.playlist_group_members;
create policy playlist_group_members_workspace on public.playlist_group_members
  for all using (
    exists (
      select 1 from public.playlist_groups g
      where g.id = playlist_group_members.group_id
        and g.workspace_id is not null
        and public.workspace_has_permission(g.workspace_id, 'view_content')
    )
  )
  with check (
    exists (
      select 1 from public.playlist_groups g
      where g.id = playlist_group_members.group_id
        and g.workspace_id is not null
        and public.workspace_has_permission(g.workspace_id, 'manage_content')
        and public.is_workspace_account_active(g.workspace_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Storage (media bucket): members may access the account owner's folder.
-- Storage stays keyed by the account owner id (no per-workspace partition);
-- the media table's workspace_id provides the in-app isolation, and production
-- media is served from MinIO (public read) rather than Supabase Storage.
-- ---------------------------------------------------------------------------
drop policy if exists media_objects_select_member on storage.objects;
create policy media_objects_select_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in (
      select ca::text from public.current_account_ids() ca
    )
  );

drop policy if exists media_objects_insert_member on storage.objects;
create policy media_objects_insert_member on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in (
      select ca::text from public.current_account_ids() ca
    )
    and public.is_account_active_by_id(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists media_objects_update_member on storage.objects;
create policy media_objects_update_member on storage.objects
  for update to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in (
      select ca::text from public.current_account_ids() ca
    )
    and public.is_account_active_by_id(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists media_objects_delete_member on storage.objects;
create policy media_objects_delete_member on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in (
      select ca::text from public.current_account_ids() ca
    )
    and public.is_account_active_by_id(((storage.foldername(name))[1])::uuid)
  );
