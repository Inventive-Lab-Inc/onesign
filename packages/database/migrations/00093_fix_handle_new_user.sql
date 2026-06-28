-- Fix handle_new_user: migrations 00086/00091 rewrote this trigger and
-- accidentally (a) inserted into a non-existent profiles.full_name column,
-- (b) dropped the trial / plan_kind / storage seeding, and (c) dropped the
-- sync_user_app_metadata() call. The bad insert made EVERY new auth user fail
-- with "Database error saving new user" (signups and invites alike).
--
-- This restores the original profile seeding (00084) and layers the workspace
-- bootstrap on top, skipping it for invited collaborators (skip_account_setup).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_name text;
  v_skip_trial boolean;
  v_skip_account_setup boolean;
  v_workspace_id uuid;
begin
  v_client_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), '')
  );

  v_skip_trial := coalesce(new.raw_user_meta_data->>'skip_trial', '') = 'true';
  v_skip_account_setup := coalesce(new.raw_user_meta_data->>'skip_account_setup', '') = 'true';

  insert into public.profiles (id, client_name, device_limit, storage_limit_bytes, trial_ends_at, plan_kind)
  values (
    new.id,
    v_client_name,
    1,
    524288000,
    case when v_skip_trial then null else now() + interval '7 days' end,
    case when v_skip_trial then 'standard' else 'trial' end
  )
  on conflict (id) do nothing;

  perform public.sync_user_app_metadata(new.id);

  -- Real (non-anonymous) account owners get a Default workspace + owner
  -- membership. Invited collaborators skip this; membership is applied by
  -- accept_account_invitations() after they set a password.
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
