-- Hard-delete a client account: audit, owned devices, profile cascade, auth user.
-- Storage objects (S3/MinIO) are removed separately by the API route.

create or replace function public.admin_delete_client(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_client_name text;
begin
  if not public.is_platform_staff_writer() then
    raise exception 'Forbidden';
  end if;

  if p_user_id is null then
    raise exception 'Missing user id';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Cannot delete your own account';
  end if;

  if exists (
    select 1
    from public.platform_staff s
    where s.user_id = p_user_id
      and s.is_active
  ) then
    raise exception 'Cannot delete platform staff accounts';
  end if;

  select u.email
  into v_email
  from auth.users u
  where u.id = p_user_id;

  if not found then
    raise exception 'User not found';
  end if;

  select p.client_name
  into v_client_name
  from public.profiles p
  where p.id = p_user_id;

  -- Record the action before deletion. target_user_id is nulled by the cascade,
  -- so the subject is preserved in metadata.
  perform public.log_admin_action(
    'account_delete',
    p_user_id,
    jsonb_build_object('email', v_email, 'client_name', v_client_name)
  );

  -- devices.owner_id is ON DELETE SET NULL, so they would otherwise be orphaned.
  delete from public.devices where owner_id = p_user_id;

  -- Cascades to profiles -> media, playlists, groups, websites, etc.
  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.admin_delete_client(uuid) from public;
grant execute on function public.admin_delete_client(uuid) to authenticated;
