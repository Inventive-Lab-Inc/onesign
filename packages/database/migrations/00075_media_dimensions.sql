-- Intrinsic pixel dimensions probed from uploaded media files.

alter table public.media
  add column if not exists width_pixels integer,
  add column if not exists height_pixels integer;

comment on column public.media.width_pixels is
  'Intrinsic width in pixels; null until probed at upload or backfill.';
comment on column public.media.height_pixels is
  'Intrinsic height in pixels; null until probed at upload or backfill.';
