-- Ensure the auto-created workspace label is always "Primary"
-- (covers any leftover casing of "Default workspace").

update public.workspaces
set name = 'Primary'
where lower(trim(name)) = 'default workspace';

create or replace function public.list_my_workspaces()
returns table (
  id uuid,
  account_id uuid,
  name text,
  is_default boolean,
  role text,
  permissions text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    w.id,
    w.account_id,
    case
      when lower(trim(w.name)) = 'default workspace' then 'Primary'
      else w.name
    end as name,
    w.is_default,
    wm.role,
    wm.permissions
  from public.workspace_members wm
  join public.workspaces w on w.id = wm.workspace_id
  where wm.user_id = auth.uid()
  order by w.is_default desc, w.created_at asc;
$$;

revoke all on function public.list_my_workspaces() from public;
grant execute on function public.list_my_workspaces() to authenticated;
