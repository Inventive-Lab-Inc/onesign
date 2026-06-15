-- Optional tags for organizing and filtering screens in the console.

alter table public.devices
  add column if not exists tags text[] not null default '{}';

create index if not exists devices_tags_gin_idx on public.devices using gin (tags);

comment on column public.devices.tags is
  'Optional labels for organizing and filtering screens in the console.';
