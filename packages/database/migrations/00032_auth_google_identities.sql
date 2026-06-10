-- Maps Google OAuth subject ids to Supabase auth.users for direct Google login (Auth.js bridge).
-- Service role only; RLS enabled with no policies blocks anon/authenticated API access.

create table if not exists public.auth_google_identities (
  google_sub text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists auth_google_identities_user_id_key
  on public.auth_google_identities (user_id);

alter table public.auth_google_identities enable row level security;
