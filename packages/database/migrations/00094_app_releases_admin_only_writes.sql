-- Lock app_releases writes to platform admins.
-- Previously INSERT/UPDATE/DELETE were open to any authenticated user
-- (USING/WITH CHECK = true), letting any signed-in customer alter or delete
-- OTA release records. Restrict all writes to platform admins; keep SELECT
-- open to authenticated so the admin dashboard can list builds.

drop policy if exists app_releases_insert_authenticated on public.app_releases;
create policy app_releases_insert_authenticated on public.app_releases
  for insert to authenticated
  with check (public.is_platform_admin() and auth.uid() = created_by);

drop policy if exists app_releases_update_authenticated on public.app_releases;
create policy app_releases_update_authenticated on public.app_releases
  for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists app_releases_delete_authenticated on public.app_releases;
create policy app_releases_delete_authenticated on public.app_releases
  for delete to authenticated
  using (public.is_platform_admin());

-- Mirror the lockdown on the releases storage bucket: admins manage APK
-- binaries, everyone keeps public read (TVs download without a signed URL).
drop policy if exists releases_objects_insert_authenticated on storage.objects;
create policy releases_objects_insert_authenticated on storage.objects
  for insert to authenticated
  with check (bucket_id = 'releases' and public.is_platform_admin());

drop policy if exists releases_objects_update_authenticated on storage.objects;
create policy releases_objects_update_authenticated on storage.objects
  for update to authenticated
  using (bucket_id = 'releases' and public.is_platform_admin());

drop policy if exists releases_objects_delete_authenticated on storage.objects;
create policy releases_objects_delete_authenticated on storage.objects
  for delete to authenticated
  using (bucket_id = 'releases' and public.is_platform_admin());
