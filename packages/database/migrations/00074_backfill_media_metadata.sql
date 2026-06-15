-- Backfill legacy media rows with inferred metadata for the content detail view.

-- Restore missing titles from the storage object name.
update public.media
set original_filename = regexp_replace(storage_path, '^.+/', '')
where original_filename is null
   or btrim(original_filename) = '';

-- Infer organization tags from file type and filename orientation hints.
update public.media as m
set tags = sub.inferred_tags
from (
  select
    id,
    array(
      select distinct tag
      from (
        select file_type::text as tag
        union all
        select case
          when lower(coalesce(original_filename, storage_path)) ~ '(portrait|vertical)' then 'portrait'
          when lower(coalesce(original_filename, storage_path)) ~ '(landscape|horizontal)' then 'landscape'
        end
      ) as tags(tag)
      where tag is not null
    ) as inferred_tags
  from public.media
) as sub
where m.id = sub.id
  and cardinality(m.tags) = 0;
