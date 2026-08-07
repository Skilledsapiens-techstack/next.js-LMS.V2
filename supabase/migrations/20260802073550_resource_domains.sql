create table if not exists public.resource_domains (
  id uuid primary key default gen_random_uuid(),
  domain_key text not null unique,
  label text not null,
  description text,
  sort_order integer not null default 100,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resource_domains_domain_key_check check (domain_key ~ '^[a-z0-9_]+$'),
  constraint resource_domains_status_check check (status in ('active', 'inactive'))
);

create index if not exists resource_domains_status_sort_idx
on public.resource_domains (status, sort_order, label);

alter table public.resources
  add column if not exists resource_domain_key text;

create index if not exists resources_resource_domain_key_idx
on public.resources (resource_domain_key, status, updated_at desc)
where resource_domain_key is not null;

insert into public.resource_domains (domain_key, label, sort_order, status)
values
  ('marketing', 'Marketing', 10, 'active'),
  ('product_management', 'Product Management', 20, 'active'),
  ('consulting', 'Consulting', 30, 'active'),
  ('finance', 'Finance', 40, 'active'),
  ('analytics', 'Analytics', 50, 'active'),
  ('hr', 'HR', 60, 'active'),
  ('placements', 'Placements', 70, 'active')
on conflict (domain_key) do update
set
  label = excluded.label,
  sort_order = excluded.sort_order,
  status = excluded.status,
  updated_at = now();

alter table public.resources
  drop constraint if exists resources_resource_domain_key_fkey;

alter table public.resources
  add constraint resources_resource_domain_key_fkey
  foreign key (resource_domain_key)
  references public.resource_domains(domain_key)
  on update cascade
  on delete set null;

alter table public.resource_domains enable row level security;

grant select, insert, update on table public.resource_domains to authenticated;

drop policy if exists "resource domains readable by resource admins" on public.resource_domains;
create policy "resource domains readable by resource admins"
on public.resource_domains for select to authenticated
using (public.admin_has_permission('admin.resources.view') or public.admin_has_permission('admin.resources.manage'));

drop policy if exists "active resource domains readable by students" on public.resource_domains;
create policy "active resource domains readable by students"
on public.resource_domains for select to authenticated
using (status = 'active');

drop policy if exists "resource domains managed by resource admins" on public.resource_domains;
create policy "resource domains managed by resource admins"
on public.resource_domains for all to authenticated
using (public.admin_has_permission('admin.resources.manage'))
with check (public.admin_has_permission('admin.resources.manage'));
