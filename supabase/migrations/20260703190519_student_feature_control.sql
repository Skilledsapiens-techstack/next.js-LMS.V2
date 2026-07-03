create table if not exists public.feature_controls (
  id uuid primary key default gen_random_uuid(),
  module_id text not null unique,
  student_label text not null,
  student_path text not null,
  status text not null default 'show',
  upcoming_message text,
  is_core boolean not null default false,
  sort_order integer not null default 100,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feature_controls_status_check check (status in ('show', 'upcoming', 'hide')),
  constraint feature_controls_dashboard_visible check (module_id <> 'dashboard' or status = 'show')
);

alter table public.feature_controls enable row level security;

grant select on table public.feature_controls to authenticated;
grant insert, update on table public.feature_controls to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_feature_controls_updated_at on public.feature_controls;
create trigger set_feature_controls_updated_at
before update on public.feature_controls
for each row execute function public.set_updated_at();

drop policy if exists "feature controls readable by authenticated users" on public.feature_controls;
create policy "feature controls readable by authenticated users"
on public.feature_controls
for select
to authenticated
using (true);

drop policy if exists "feature controls insertable by active admins" on public.feature_controls;
create policy "feature controls insertable by active admins"
on public.feature_controls
for insert
to authenticated
with check ((select public.is_active_admin()));

drop policy if exists "feature controls updateable by active admins" on public.feature_controls;
create policy "feature controls updateable by active admins"
on public.feature_controls
for update
to authenticated
using ((select public.is_active_admin()))
with check ((select public.is_active_admin()));

insert into public.feature_controls (module_id, student_label, student_path, status, upcoming_message, is_core, sort_order)
values
  ('dashboard', 'Dashboard', '/student', 'show', null, true, 10),
  ('cohorts', 'My Programs', '/student/cohorts', 'show', null, false, 20),
  ('recordings', 'Recordings', '/student/recordings', 'show', null, false, 30),
  ('schedule', 'Schedule', '/student/schedule', 'show', null, false, 40),
  ('resources', 'Resources', '/student/resources', 'show', null, false, 50),
  ('projects', 'Live Project Hub', '/student/projects', 'show', null, false, 60),
  ('project-submissions', 'My Submissions', '/student/project-submissions', 'show', null, false, 70),
  ('certificates', 'Certificates', '/student/certificates', 'show', null, false, 80),
  ('community', 'Community', '/student/community', 'show', null, false, 90),
  ('announcements', 'Announcements', '/student/announcements', 'show', null, false, 100),
  ('support', 'Support', '/student/support', 'show', null, false, 110),
  ('payments', 'Payments & Access', '/student/payments', 'show', null, false, 120)
on conflict (module_id) do update
set
  student_label = excluded.student_label,
  student_path = excluded.student_path,
  is_core = excluded.is_core,
  sort_order = excluded.sort_order,
  updated_at = now();

drop policy if exists "admin feature control writes can be audited by active admins" on public.audit_logs;
create policy "admin feature control writes can be audited by active admins"
on public.audit_logs
for insert
to authenticated
with check (
  public.is_active_admin()
  and actor_role = 'admin'
  and entity_type = 'feature_control'
  and action in (
    'admin_feature_control_updated',
    'admin_feature_control_status_changed'
  )
);
