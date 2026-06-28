-- Workspaces foundation (Phase 1 — additive, non-destructive).
--
-- Introduces multi-workspace, multi-user accounts:
--   * An "account" remains public.profiles (the billing entity / account owner).
--   * Each account owns one or more workspaces. Content rows gain workspace_id.
--   * Users join an account (account_members) and get a per-workspace role
--     (workspace_members). Absence of a workspace_members row = "No access".
--
-- This migration ONLY adds tables/columns and backfills existing data. It does
-- NOT change existing RLS on content tables, so current single-user accounts
-- keep working exactly as before. Membership-aware RLS lands in a later phase.

-- ---------------------------------------------------------------------------
-- Workspaces
-- ---------------------------------------------------------------------------
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  constraint workspaces_name_not_blank check (length(trim(name)) > 0)
);

create index if not exists workspaces_account_id_idx on public.workspaces (account_id);

-- At most one default workspace per account.
create unique index if not exists workspaces_one_default_per_account
  on public.workspaces (account_id)
  where is_default;

comment on table public.workspaces is
  'Account sub-tenant: isolates screens, content and user access within one billing account.';

-- ---------------------------------------------------------------------------
-- Account members: which users belong to an account (the "Users" tab).
-- ---------------------------------------------------------------------------
create table if not exists public.account_members (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Account owner is the original profile owner; only one per account.
  is_owner boolean not null default false,
  created_at timestamptz not null default now(),
  constraint account_members_unique unique (account_id, user_id)
);

create index if not exists account_members_account_id_idx on public.account_members (account_id);
create index if not exists account_members_user_id_idx on public.account_members (user_id);

create unique index if not exists account_members_one_owner_per_account
  on public.account_members (account_id)
  where is_owner;

comment on table public.account_members is
  'Users belonging to an account. Owner is the original profile; others are invited collaborators.';

-- ---------------------------------------------------------------------------
-- Workspace members: per-workspace role + optional custom permission set.
-- ---------------------------------------------------------------------------
-- Roles mirror the product UI:
--   owner          - account owner, implicit full access (set on backfill / account create)
--   account_admin  - full access including billing and user management
--   admin          - full access including user management (no billing)
--   standard       - manage screens, content, and playlists
--   content_manager- manage content and playlists
--   custom         - explicit permissions in `permissions`
create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'standard'
    check (role in ('owner', 'account_admin', 'admin', 'standard', 'content_manager', 'custom')),
  -- Only meaningful when role = 'custom'. Valid keys are validated in the app layer.
  permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint workspace_members_unique unique (workspace_id, user_id)
);

create index if not exists workspace_members_workspace_id_idx on public.workspace_members (workspace_id);
create index if not exists workspace_members_user_id_idx on public.workspace_members (user_id);

comment on table public.workspace_members is
  'Per-workspace access for a user. No row for a (workspace,user) pair means no access.';

-- ---------------------------------------------------------------------------
-- Add workspace_id to content tables (nullable now; backfilled below).
-- ---------------------------------------------------------------------------
alter table public.devices         add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;
alter table public.media           add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;
alter table public.playlists       add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;
alter table public.websites        add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;
alter table public.device_groups   add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;
alter table public.media_groups    add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;
alter table public.playlist_groups add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;

create index if not exists devices_workspace_id_idx on public.devices (workspace_id);
create index if not exists media_workspace_id_idx on public.media (workspace_id);
create index if not exists playlists_workspace_id_idx on public.playlists (workspace_id);
create index if not exists websites_workspace_id_idx on public.websites (workspace_id);
create index if not exists device_groups_workspace_id_idx on public.device_groups (workspace_id);
create index if not exists media_groups_workspace_id_idx on public.media_groups (workspace_id);
create index if not exists playlist_groups_workspace_id_idx on public.playlist_groups (workspace_id);

-- ---------------------------------------------------------------------------
-- Backfill: one Default workspace per existing account, owner membership,
-- and stamp existing content with that workspace.
-- ---------------------------------------------------------------------------
do $$
declare
  rec record;
  v_workspace_id uuid;
begin
  for rec in select id from public.profiles loop
    -- Default workspace (idempotent: reuse if one already exists).
    select w.id into v_workspace_id
    from public.workspaces w
    where w.account_id = rec.id and w.is_default
    limit 1;

    if v_workspace_id is null then
      insert into public.workspaces (account_id, name, is_default)
      values (rec.id, 'Default workspace', true)
      returning id into v_workspace_id;
    end if;

    -- Account owner membership.
    insert into public.account_members (account_id, user_id, is_owner)
    values (rec.id, rec.id, true)
    on conflict (account_id, user_id) do update set is_owner = true;

    -- Owner has the 'owner' role in the default workspace.
    insert into public.workspace_members (workspace_id, user_id, role)
    values (v_workspace_id, rec.id, 'owner')
    on conflict (workspace_id, user_id) do update set role = 'owner';

    -- Stamp existing content (owner_id is the account owner) into the default workspace.
    update public.devices         set workspace_id = v_workspace_id where owner_id = rec.id and workspace_id is null;
    update public.media           set workspace_id = v_workspace_id where owner_id = rec.id and workspace_id is null;
    update public.playlists       set workspace_id = v_workspace_id where owner_id = rec.id and workspace_id is null;
    update public.websites        set workspace_id = v_workspace_id where owner_id = rec.id and workspace_id is null;
    update public.device_groups   set workspace_id = v_workspace_id where owner_id = rec.id and workspace_id is null;
    update public.media_groups    set workspace_id = v_workspace_id where owner_id = rec.id and workspace_id is null;
    update public.playlist_groups set workspace_id = v_workspace_id where owner_id = rec.id and workspace_id is null;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- New-account hook: create a Default workspace + owner membership on signup.
-- Extends handle_new_user without dropping its existing profile insert.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', null))
  on conflict (id) do nothing;

  -- Only real (non-anonymous) users get an account workspace. TV sessions are
  -- anonymous and never own profiles content beyond device registration.
  if coalesce(new.is_anonymous, false) = false then
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

-- ---------------------------------------------------------------------------
-- Membership lookup helpers (SECURITY DEFINER to avoid RLS recursion).
-- ---------------------------------------------------------------------------

-- Workspace ids the current user can access (has a workspace_members row).
create or replace function public.current_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select wm.workspace_id
  from public.workspace_members wm
  where wm.user_id = auth.uid();
$$;

revoke all on function public.current_workspace_ids() from public;
grant execute on function public.current_workspace_ids() to authenticated;

-- Account ids the current user belongs to.
create or replace function public.current_account_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select am.account_id
  from public.account_members am
  where am.user_id = auth.uid();
$$;

revoke all on function public.current_account_ids() from public;
grant execute on function public.current_account_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS on new tables. Membership-aware content RLS comes in a later phase;
-- here we secure the membership tables themselves. Direct reads are kept tight
-- (self + staff); management views use SECURITY DEFINER RPCs.
-- ---------------------------------------------------------------------------
alter table public.workspaces enable row level security;
alter table public.account_members enable row level security;
alter table public.workspace_members enable row level security;

-- Workspaces: a user reads workspaces they are a member of; staff read all.
-- (Account owners hold an owner membership row in every workspace they create.)
drop policy if exists workspaces_select_member on public.workspaces;
create policy workspaces_select_member on public.workspaces
  for select using (
    id in (select public.current_workspace_ids())
    or public.is_platform_staff()
  );

-- Account members: a user reads only their own membership rows; staff read all.
drop policy if exists account_members_select on public.account_members;
create policy account_members_select on public.account_members
  for select using (
    user_id = auth.uid()
    or public.is_platform_staff()
  );

-- Workspace members: a user reads only their own membership rows; staff read all.
drop policy if exists workspace_members_select on public.workspace_members;
create policy workspace_members_select on public.workspace_members
  for select using (
    user_id = auth.uid()
    or public.is_platform_staff()
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.workspaces;
alter publication supabase_realtime add table public.workspace_members;
