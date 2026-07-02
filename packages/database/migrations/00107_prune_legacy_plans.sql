-- Remove retired catalog tiers; public pricing is Solo / Growth / Network only.

delete from public.plan_templates
where name in ('Free', 'Starter', 'Business', 'Enterprise');

update public.plan_templates
set
  is_active = true,
  sort_order = case name
    when 'Solo' then 0
    when 'Growth' then 1
    when 'Network' then 2
    else sort_order
  end,
  updated_at = now()
where name in ('Solo', 'Growth', 'Network');
