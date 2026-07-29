create table if not exists public.student_roster_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,
  student_count integer not null default 0,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  created_by text,
  restored_at timestamptz,
  restored_by text,
  restore_note text
);

create index if not exists student_roster_snapshots_date_idx
  on public.student_roster_snapshots (snapshot_date desc);

alter table public.student_roster_snapshots enable row level security;

grant select, insert, update, delete on table public.student_roster_snapshots to authenticated;

drop policy if exists "student roster snapshots readable by student managers" on public.student_roster_snapshots;
create policy "student roster snapshots readable by student managers"
on public.student_roster_snapshots for select to authenticated
using (public.admin_has_permission('admin.students.manage'));

drop policy if exists "student roster snapshots managed by student managers" on public.student_roster_snapshots;
create policy "student roster snapshots managed by student managers"
on public.student_roster_snapshots for all to authenticated
using (public.admin_has_permission('admin.students.manage'))
with check (public.admin_has_permission('admin.students.manage'));

drop policy if exists "admin student writes can be audited by student admins" on public.audit_logs;
create policy "admin student writes can be audited by student admins"
on public.audit_logs for insert to authenticated
with check (
  actor_role = 'admin'
  and entity_type = 'student'
  and lower(coalesce(actor_email, '')) = public.current_auth_email()
  and (
    (
      public.admin_has_permission('admin.students.manage')
      and action in (
        'admin_student_auth_linked',
        'admin_student_created',
        'admin_student_updated',
        'admin_student_status_changed',
        'admin_student_lp_attempts_updated',
        'admin_student_preview_started',
        'admin_student_roster_snapshot_created',
        'admin_student_roster_restored'
      )
    )
    or (
      public.admin_has_permission('admin.students.invite')
      and action in (
        'admin_student_invite_queued',
        'admin_student_onboarding_mail_queued'
      )
    )
  )
);
