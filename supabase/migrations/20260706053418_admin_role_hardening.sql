-- Phase 2 admin RBAC hardening.
-- The frontend may hide buttons for UX, but these policies make Postgres the
-- source of truth for sensitive admin access.

create or replace function public.admin_has_permission(required_permission text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  with role_scope as (
    select public.current_admin_role() as role_key
  )
  select case
    when required_permission is null or btrim(required_permission) = '' then false
    when role_key = 'super_admin' then true
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
      'admin.support.view',
      'admin.support.manage',
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
      'admin.support.view',
      'admin.support.manage',
      'admin.observability.view'
    ]::text[])
    else false
  end
  from role_scope;
$$;

revoke all on function public.admin_has_permission(text) from public;
grant execute on function public.admin_has_permission(text) to authenticated;

grant select on table public.admin_users to authenticated;

drop policy if exists "admin users can read own active profile" on public.admin_users;
create policy "admin users can read own active profile"
on public.admin_users
for select
to authenticated
using (
  (
    status = 'active'
    and (
      auth_user_id = (select auth.uid())
      or lower(email) = public.current_auth_email()
    )
  )
  or public.admin_has_permission('admin.admin_users.view')
);

drop policy if exists "recording candidates readable by active admins" on public.workshop_recording_candidates;
create policy "recording candidates readable by permitted admins"
on public.workshop_recording_candidates
for select
to authenticated
using (public.admin_has_permission('admin.recordings.view'));

drop policy if exists "feature controls insertable by active admins" on public.feature_controls;
create policy "feature controls insertable by super admins"
on public.feature_controls
for insert
to authenticated
with check (public.admin_has_permission('admin.feature_control.manage'));

drop policy if exists "feature controls updateable by active admins" on public.feature_controls;
create policy "feature controls updateable by super admins"
on public.feature_controls
for update
to authenticated
using (public.admin_has_permission('admin.feature_control.manage'))
with check (public.admin_has_permission('admin.feature_control.manage'));

drop policy if exists "active admins can read certificate templates" on public.certificate_templates;
create policy "certificate templates readable by certificate admins"
on public.certificate_templates
for select
to authenticated
using (public.admin_has_permission('admin.certificates.view'));

drop policy if exists "active admins can manage certificate templates" on public.certificate_templates;
create policy "certificate templates manageable by certificate issuers"
on public.certificate_templates
for all
to authenticated
using (public.admin_has_permission('admin.certificates.issue'))
with check (public.admin_has_permission('admin.certificates.issue'));

drop policy if exists "system event logs readable by active admins" on public.system_event_logs;
create policy "system event logs readable by observability admins"
on public.system_event_logs
for select
to authenticated
using (public.admin_has_permission('admin.observability.view'));

drop policy if exists "system event logs insertable by active admins" on public.system_event_logs;
create policy "system event logs insertable by observability admins"
on public.system_event_logs
for insert
to authenticated
with check (public.admin_has_permission('admin.observability.view'));

drop policy if exists "system alerts readable by active admins" on public.system_alerts;
create policy "system alerts readable by observability admins"
on public.system_alerts
for select
to authenticated
using (public.admin_has_permission('admin.observability.view'));

drop policy if exists "system alerts insertable by active admins" on public.system_alerts;
create policy "system alerts insertable by observability admins"
on public.system_alerts
for insert
to authenticated
with check (public.admin_has_permission('admin.observability.view'));

drop policy if exists "system alerts updateable by active admins" on public.system_alerts;
create policy "system alerts updateable by super admins"
on public.system_alerts
for update
to authenticated
using (public.admin_has_permission('admin.admin_users.manage'))
with check (public.admin_has_permission('admin.admin_users.manage'));

drop policy if exists "workshops writable by active admins" on public.workshops;
create policy "workshops writable by meeting admins"
on public.workshops
for insert
to authenticated
with check (public.admin_has_permission('admin.meetings.manage'));

drop policy if exists "workshops updateable by active admins" on public.workshops;
create policy "workshops updateable by meeting admins"
on public.workshops
for update
to authenticated
using (public.admin_has_permission('admin.meetings.manage'))
with check (public.admin_has_permission('admin.meetings.manage'));

drop policy if exists "programs writable by active admins" on public.programs;
create policy "programs writable by program admins"
on public.programs
for insert
to authenticated
with check (public.admin_has_permission('admin.programs.manage'));

drop policy if exists "programs updatable by active admins" on public.programs;
create policy "programs updatable by program admins"
on public.programs
for update
to authenticated
using (public.admin_has_permission('admin.programs.manage'))
with check (public.admin_has_permission('admin.programs.manage'));

drop policy if exists "support faqs managed by active admins" on public.support_faqs;
create policy "support faqs managed by support admins"
on public.support_faqs
for all
to authenticated
using (public.admin_has_permission('admin.support.manage'))
with check (public.admin_has_permission('admin.support.manage'));

drop policy if exists "support emails can be queued by active admins" on public.email_queue;
create policy "support emails can be queued by support admins"
on public.email_queue
for insert
to authenticated
with check (
  public.admin_has_permission('admin.support.manage')
  and category = 'support'
);

drop policy if exists "admin student invite emails can be queued by active admins" on public.email_queue;
create policy "admin student invite emails can be queued by student inviters"
on public.email_queue
for insert
to authenticated
with check (
  public.admin_has_permission('admin.students.invite')
  and category = 'auth'
  and status = 'queued'
  and related_entity_type = 'student'
  and template_key in ('portal_invite', 'onboarding_welcome')
  and lower(coalesce(created_by, '')) = public.current_auth_email()
);

drop policy if exists "email center audit logs can be inserted by active admins" on public.audit_logs;
create policy "email center audit logs can be inserted by email admins"
on public.audit_logs
for insert
to authenticated
with check (
  public.admin_has_permission('admin.email.manage')
  and actor_role = 'admin'
  and entity_type in ('email_template', 'email_queue', 'email')
);

drop policy if exists "admin feature control writes can be audited by active admins" on public.audit_logs;
create policy "admin feature control writes can be audited by super admins"
on public.audit_logs
for insert
to authenticated
with check (
  public.admin_has_permission('admin.feature_control.manage')
  and actor_role = 'admin'
  and entity_type = 'feature_control'
);
