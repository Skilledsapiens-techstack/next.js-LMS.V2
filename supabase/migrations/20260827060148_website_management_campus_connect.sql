create table if not exists public.website_campus_inquiries (
  id uuid primary key default gen_random_uuid(),
  source_page text not null default 'campus-connect',
  name text not null,
  designation text not null,
  institution_name text not null,
  email text not null,
  phone text not null,
  partner_type text not null,
  interested_in text not null,
  message text,
  status text not null default 'new',
  submitted_by_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint website_campus_inquiries_status_check check (status in ('new', 'contacted', 'archived')),
  constraint website_campus_inquiries_source_page_check check (source_page in ('campus-connect')),
  constraint website_campus_inquiries_email_check check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create table if not exists public.website_nav_modules (
  id uuid primary key default gen_random_uuid(),
  module_key text not null unique,
  label text not null,
  nav_group text not null default 'main',
  slug text not null,
  status text not null default 'visible',
  sort_order integer not null default 0,
  is_core boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint website_nav_modules_key_check check (module_key ~ '^[a-z0-9-]+$'),
  constraint website_nav_modules_status_check check (status in ('visible', 'hidden')),
  constraint website_nav_modules_group_check check (nav_group in ('main', 'placement'))
);

create index if not exists website_campus_inquiries_status_created_idx
  on public.website_campus_inquiries (status, created_at desc);

create index if not exists website_campus_inquiries_email_idx
  on public.website_campus_inquiries (lower(email));

create index if not exists website_nav_modules_status_order_idx
  on public.website_nav_modules (status, sort_order);

drop trigger if exists set_website_campus_inquiries_updated_at on public.website_campus_inquiries;
create trigger set_website_campus_inquiries_updated_at
before update on public.website_campus_inquiries
for each row execute function public.set_updated_at();

drop trigger if exists set_website_nav_modules_updated_at on public.website_nav_modules;
create trigger set_website_nav_modules_updated_at
before update on public.website_nav_modules
for each row execute function public.set_updated_at();

insert into public.website_nav_modules (module_key, label, nav_group, slug, status, sort_order, is_core, settings)
values
  ('home', 'Home', 'main', 'home', 'visible', 10, true, '{}'::jsonb),
  ('placement-mentorship', 'Placement Mentorship', 'main', 'placement-mentorship', 'visible', 20, false, '{"hasDropdown": true}'::jsonb),
  ('placement-mentorship-students', 'Students', 'placement', 'placement-mentorship', 'visible', 21, false, '{}'::jsonb),
  ('placement-mentorship-professionals', 'Working Professionals', 'placement', 'placement-mentorship-professionals', 'visible', 22, false, '{}'::jsonb),
  ('live-projects', 'Live Projects', 'main', 'live-projects', 'visible', 30, false, '{}'::jsonb),
  ('leadership-programs', 'Leadership Programs', 'main', 'leadership-programs', 'visible', 40, false, '{}'::jsonb),
  ('business-connect', 'Business Connect', 'main', 'business-connect', 'visible', 50, false, '{}'::jsonb),
  ('campus-connect', 'Campus Connect', 'main', 'campus-connect', 'visible', 60, false, '{}'::jsonb)
on conflict (module_key) do update
set
  label = excluded.label,
  nav_group = excluded.nav_group,
  slug = excluded.slug,
  sort_order = excluded.sort_order,
  is_core = excluded.is_core,
  settings = public.website_nav_modules.settings || excluded.settings;

alter table public.website_campus_inquiries enable row level security;
alter table public.website_nav_modules enable row level security;

grant insert on table public.website_campus_inquiries to anon, authenticated;
grant select, update on table public.website_campus_inquiries to authenticated;
grant select on table public.website_nav_modules to anon, authenticated;
grant update on table public.website_nav_modules to authenticated;

drop policy if exists "campus inquiries insertable publicly" on public.website_campus_inquiries;
create policy "campus inquiries insertable publicly"
on public.website_campus_inquiries for insert to anon, authenticated
with check (true);

drop policy if exists "campus inquiries readable by website admins" on public.website_campus_inquiries;
create policy "campus inquiries readable by website admins"
on public.website_campus_inquiries for select to authenticated
using (public.admin_has_permission('admin.website.view'));

drop policy if exists "campus inquiries manageable by website admins" on public.website_campus_inquiries;
create policy "campus inquiries manageable by website admins"
on public.website_campus_inquiries for update to authenticated
using (public.admin_has_permission('admin.website.manage'))
with check (public.admin_has_permission('admin.website.manage'));

drop policy if exists "website nav readable publicly" on public.website_nav_modules;
create policy "website nav readable publicly"
on public.website_nav_modules for select to anon, authenticated
using (true);

drop policy if exists "website nav manageable by website admins" on public.website_nav_modules;
create policy "website nav manageable by website admins"
on public.website_nav_modules for update to authenticated
using (public.admin_has_permission('admin.website.manage'))
with check (public.admin_has_permission('admin.website.manage'));

create or replace function public.admin_has_permission(required_permission text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  with access_scope as (
    select
      public.current_admin_role() as role_key,
      public.current_admin_permissions() as custom_permissions
  )
  select case
    when required_permission is null or btrim(required_permission) = '' then false
    when role_key = 'super_admin' then true
    when custom_permissions is not null then required_permission = any(custom_permissions)
    when role_key = 'admin' then required_permission = any(array[
      'admin.dashboard.view',
      'admin.students.view',
      'admin.students.manage',
      'admin.students.import',
      'admin.students.export',
      'admin.students.invite',
      'admin.cohorts.view',
      'admin.cohorts.manage',
      'admin.programs.view',
      'admin.programs.manage',
      'admin.projects.view',
      'admin.projects.manage',
      'admin.submissions.view',
      'admin.submissions.review',
      'admin.meetings.view',
      'admin.meetings.manage',
      'admin.recordings.view',
      'admin.recordings.manage',
      'admin.resources.view',
      'admin.resources.manage',
      'admin.certificates.view',
      'admin.certificates.issue',
      'admin.enrollments.view',
      'admin.announcements.view',
      'admin.announcements.manage',
      'admin.community.view',
      'admin.community.manage',
      'admin.support.view',
      'admin.support.manage',
      'admin.website.view',
      'admin.website.manage',
      'admin.observability.view'
    ]::text[])
    when role_key = 'moderator' then required_permission = any(array[
      'admin.dashboard.view',
      'admin.students.view',
      'admin.submissions.view',
      'admin.submissions.review',
      'admin.recordings.view',
      'admin.recordings.manage',
      'admin.certificates.view',
      'admin.announcements.view',
      'admin.community.view',
      'admin.support.view',
      'admin.support.manage',
      'admin.observability.view'
    ]::text[])
    else false
  end
  from access_scope;
$$;
