create table if not exists public.certificate_review_items (
  id uuid primary key default gen_random_uuid(),
  review_key text not null unique,
  certificate_type text not null default 'leadership',
  review_status text not null default 'pending',
  reason_code text not null,
  reason text not null,
  expected_action text,
  student_id uuid references public.students(id) on delete set null,
  student_email text,
  student_name text,
  program_key text,
  program_name text,
  cohort_name text,
  live_project_role_ids text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by text,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint certificate_review_items_certificate_type_check
    check (certificate_type in ('leadership', 'live_project')),
  constraint certificate_review_items_review_status_check
    check (review_status in ('pending', 'resolved', 'dismissed'))
);

create index if not exists certificate_review_items_status_updated_idx
  on public.certificate_review_items (review_status, updated_at desc);

create index if not exists certificate_review_items_student_program_idx
  on public.certificate_review_items (student_id, program_key, cohort_name);

alter table public.certificate_review_items enable row level security;

drop policy if exists "certificate review items readable by certificate admins" on public.certificate_review_items;
create policy "certificate review items readable by certificate admins"
on public.certificate_review_items for select to authenticated
using (public.admin_has_permission('admin.certificates.view'));

drop policy if exists "certificate review items insertable by certificate issuers" on public.certificate_review_items;
create policy "certificate review items insertable by certificate issuers"
on public.certificate_review_items for insert to authenticated
with check (public.admin_has_permission('admin.certificates.issue'));

drop policy if exists "certificate review items manageable by certificate issuers" on public.certificate_review_items;
create policy "certificate review items manageable by certificate issuers"
on public.certificate_review_items for update to authenticated
using (public.admin_has_permission('admin.certificates.issue'))
with check (public.admin_has_permission('admin.certificates.issue'));
