-- ATS Resume Score: admin controls for student-specific free scan limits.
-- Advanced scans continue to use the existing ats_student_credit_grants ledger.

create table if not exists public.ats_student_scan_limits (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  student_email text not null,
  free_attempts_limit integer not null default 2,
  notes text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ats_student_scan_limits_student_unique unique (student_id),
  constraint ats_student_scan_limits_email_unique unique (student_email),
  constraint ats_student_scan_limits_free_limit_check check (free_attempts_limit between 0 and 500)
);

create index if not exists ats_student_scan_limits_email_idx
on public.ats_student_scan_limits (lower(student_email));

drop trigger if exists set_ats_student_scan_limits_updated_at on public.ats_student_scan_limits;
create trigger set_ats_student_scan_limits_updated_at
before update on public.ats_student_scan_limits
for each row execute function public.set_updated_at();

alter table public.ats_student_scan_limits enable row level security;

grant select, insert, update on table public.ats_student_scan_limits to authenticated;

drop policy if exists "ats scan limits readable by owner or ats admins" on public.ats_student_scan_limits;
create policy "ats scan limits readable by owner or ats admins"
on public.ats_student_scan_limits for select to authenticated
using (lower(btrim(student_email)) = public.current_auth_email() or public.admin_has_permission('admin.ats.view'));

drop policy if exists "ats scan limits manageable by ats admins" on public.ats_student_scan_limits;
create policy "ats scan limits manageable by ats admins"
on public.ats_student_scan_limits for all to authenticated
using (public.admin_has_permission('admin.ats.manage'))
with check (public.admin_has_permission('admin.ats.manage'));

drop policy if exists "ats attempts insertable by owner or ats admins" on public.ats_attempts;
create policy "ats attempts insertable by owner or ats admins"
on public.ats_attempts for insert to authenticated
with check (
  (
    lower(btrim(student_email)) = public.current_auth_email()
    and scan_mode = 'basic'
    and access_type = 'free'
    and jd_match_used is false
    and credit_grant_id is null
    and (
      select count(*)
      from public.ats_attempts existing_attempt
      where lower(btrim(existing_attempt.student_email)) = public.current_auth_email()
        and existing_attempt.access_type = 'free'
        and existing_attempt.scan_mode = 'basic'
    ) < coalesce(
      (
        select limit_row.free_attempts_limit
        from public.ats_student_scan_limits limit_row
        where lower(btrim(limit_row.student_email)) = public.current_auth_email()
        limit 1
      ),
      2
    )
  )
  or public.admin_has_permission('admin.ats.manage')
);
