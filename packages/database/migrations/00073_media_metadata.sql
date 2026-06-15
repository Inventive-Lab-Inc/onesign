-- Optional metadata for organizing and scheduling content in the console.

alter table public.media
  add column if not exists description text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists display_from timestamptz,
  add column if not exists display_until timestamptz;

create index if not exists media_tags_gin_idx on public.media using gin (tags);

comment on column public.media.description is
  'Optional description shown in the content library and detail view.';
comment on column public.media.tags is
  'Optional labels for organizing and filtering content in the console.';
comment on column public.media.display_from is
  'Optional start date after which this content may be shown on screens.';
comment on column public.media.display_until is
  'Optional expiry date after which this content should not be shown on screens.';
