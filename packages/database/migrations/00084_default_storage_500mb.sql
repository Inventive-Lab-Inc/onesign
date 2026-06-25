-- New self-serve signups now get 500 MB of storage by default (was 2 GiB).
-- Updates both the new-user trigger and the column default. Existing accounts
-- keep their current storage_limit_bytes.

alter table public.profiles
  alter column storage_limit_bytes set default 524288000;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_name text;
  v_skip_trial boolean;
begin
  v_client_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), '')
  );

  v_skip_trial := coalesce(new.raw_user_meta_data->>'skip_trial', '') = 'true';

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
  return new;
end;
$$;
