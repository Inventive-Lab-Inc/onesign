-- playlist_items.duration_seconds is image dwell only; videos use media.duration_seconds.
alter table public.playlist_items
  alter column duration_seconds drop default,
  alter column duration_seconds drop not null;

comment on column public.playlist_items.duration_seconds is
  'Image dwell time in seconds. Null for video (length comes from media.duration_seconds).';

update public.playlist_items pi
set duration_seconds = null
from public.media m
where pi.media_id = m.id
  and m.file_type = 'video';
