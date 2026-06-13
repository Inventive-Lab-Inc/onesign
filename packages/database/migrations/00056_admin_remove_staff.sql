-- Allow platform owners to revoke admin portal access for operators/viewers.

create or replace function public.admin_remove_staff(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_target_role text;
begin
  if not public.is_platform_admin() then
    raise exception 'Forbidden';
  end if;

  if not exists (
    select 1
    from public.platform_staff s
    where s.user_id = auth.uid()
      and s.is_active
      and s.role = 'owner'
  ) then
    raise exception 'Only platform owners can manage staff';
  end if;

  if p_user_id is null then
    raise exception 'Missing user id';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'You cannot remove yourself';
  end if;

  select s.role
  into v_target_role
  from public.platform_staff s
  where s.user_id = p_user_id
    and s.is_active;

  if v_target_role is null then
    raise exception 'Admin not found';
  end if;

  if v_target_role = 'owner' then
    raise exception 'Cannot remove an owner';
  end if;

  update public.platform_staff
  set is_active = false
  where user_id = p_user_id;

  perform public.sync_user_app_metadata(p_user_id);
  perform public.log_admin_action(
    'staff.remove',
    p_user_id,
    jsonb_build_object('role', v_target_role)
  );
end;
$$;

revoke all on function public.admin_remove_staff(uuid) from public;
grant execute on function public.admin_remove_staff(uuid) to authenticated;
