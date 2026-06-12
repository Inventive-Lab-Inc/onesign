-- Align storage_limit_bytes column comment with product terminology.

comment on column public.profiles.storage_limit_bytes is
  'Maximum cloud storage for this client (bytes). Default 2 GiB.';

comment on column public.media.size_bytes is
  'Object size in bytes at upload time; used for per-client storage quotas.';
