-- Account invite wiring: skip personal account for invited collaborators,
-- and allow revoking pending invitations from the Users tab.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_skip_account_setup boolean;
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', null))
  on conflict (id) do nothing;

  v_skip_account_setup := coalesce(new.raw_user_meta_data->>'skip_account_setup', '') = 'true';

  -- Invited account collaborators skip their own workspace; membership is applied
  -- via accept_account_invitations() after they set a password.
  if coalesce(new.is_anonymous, false) = false and not v_skip_account_setup then
    select w.id into v_workspace_id
    from public.workspaces w
    where w.account_id = new.id and w.is_default
    limit 1;

    if v_workspace_id is null then
      insert into public.workspaces (account_id, name, is_default)
      values (new.id, 'Default workspace', true)
      returning id into v_workspace_id;
    end if;

    insert into public.account_members (account_id, user_id, is_owner)
    values (new.id, new.id, true)
    on conflict (account_id, user_id) do nothing;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (v_workspace_id, new.id, 'owner')
    on conflict (workspace_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

-- Revoke a pending invitation by email (Users tab).
create or replace function public.revoke_account_invitation(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid := public.primary_account_id();
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_account_id is null then
    raise exception 'no_account';
  end if;
  if not public.can_admin_account(v_account_id) then
    raise exception 'forbidden';
  end if;
  if v_email = '' then
    raise exception 'email_required';
  end if;

  update public.account_invitations
  set status = 'revoked'
  where account_id = v_account_id
    and lower(email) = v_email
    and status = 'pending';
end;
$$;

revoke all on function public.revoke_account_invitation(text) from public;
grant execute on function public.revoke_account_invitation(text) to authenticated;
