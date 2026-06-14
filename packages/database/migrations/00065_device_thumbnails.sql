-- Optional screen thumbnail (image stored in object storage, path on device row).

alter table public.devices
  add column if not exists thumbnail_storage_path text;

comment on column public.devices.thumbnail_storage_path is
  'Public object-storage path for the screen thumbnail image (owner-scoped prefix).';
