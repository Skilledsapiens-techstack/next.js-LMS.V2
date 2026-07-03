insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('certificate-templates', 'certificate-templates', false, 10485760, array['application/pdf']),
  ('temporary-certificates', 'temporary-certificates', false, 10485760, array['application/pdf'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.certificate_templates (
  id uuid primary key default gen_random_uuid(),
  template_type text not null check (template_type in ('leadership_program', 'live_project')),
  template_name text not null,
  storage_bucket text not null default 'certificate-templates',
  storage_path text not null,
  version integer not null default 1 check (version > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists certificate_templates_one_active_per_type
on public.certificate_templates (template_type)
where is_active;

alter table public.certificate_templates enable row level security;

grant select, insert, update on table public.certificate_templates to authenticated;

drop policy if exists "active admins can read certificate templates" on public.certificate_templates;
create policy "active admins can read certificate templates"
on public.certificate_templates
for select
to authenticated
using (public.is_active_admin());

drop policy if exists "active admins can manage certificate templates" on public.certificate_templates;
create policy "active admins can manage certificate templates"
on public.certificate_templates
for all
to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());

insert into public.certificate_templates (template_type, template_name, storage_path, version, is_active)
values
  ('leadership_program', 'Leadership Program Certificate', 'leadership-program/master-template.pdf', 1, true),
  ('live_project', 'Live Project Certificate', 'live-project/master-template.pdf', 1, true)
on conflict do nothing;
