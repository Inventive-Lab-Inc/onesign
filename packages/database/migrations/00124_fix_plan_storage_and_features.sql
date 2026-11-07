-- Align plan_templates storage + marketing features with intended tiers:
-- Solo 500 MB (no watermark entitlement), Growth 3 GB, Network 10 GB.

update public.plan_templates
set
  storage_limit_bytes = 524288000::bigint,
  features = array[
    '500 MB media storage',
    'No watermark',
    'Scheduling & live widgets',
    'Email support'
  ],
  updated_at = now()
where name = 'Solo'
  and is_active;

update public.plan_templates
set
  storage_limit_bytes = 3221225472::bigint,
  features = array[
    'entitlement:user_limit:2',
    '3 GB media storage',
    'Screen groups & bulk deploy',
    'Website & live widgets',
    'Advanced scheduling',
    'Priority email support'
  ],
  updated_at = now()
where name = 'Growth'
  and is_active;

update public.plan_templates
set
  storage_limit_bytes = 10737418240::bigint,
  features = array[
    '10 GB media storage',
    'Unlimited groups & playlists',
    'Audit logs & team roles',
    'Priority + phone support'
  ],
  updated_at = now()
where name = 'Network'
  and is_active;
