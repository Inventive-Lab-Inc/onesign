-- Per-workspace stats for the account Workspaces tab (screens / media / users).

create or replace function public.list_account_workspaces()
returns table (
  id uuid,
  name text,
  is_default boolean,
  screen_count bigint,
  media_count bigint,
  user_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid := public.primary_account_id();
begin
  if v_account_id is null then
    raise exception 'no_account';
  end if;
  if not public.can_admin_account(v_account_id) then
    raise exception 'forbidden';
  end if;

  return query
  select
    w.id,
    w.name,
    w.is_default,
    (select count(*) from public.devices d where d.workspace_id = w.id) as screen_count,
    (select count(*) from public.media m where m.workspace_id = w.id) as media_count,
    (select count(*) from public.workspace_members wm where wm.workspace_id = w.id) as user_count
  from public.workspaces w
  where w.account_id = v_account_id
  order by w.is_default desc, w.created_at asc;
end;
$$;

revoke all on function public.list_account_workspaces() from public;
grant execute on function public.list_account_workspaces() to authenticated;
