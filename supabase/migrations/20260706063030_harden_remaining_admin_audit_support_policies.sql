-- Finish removing broad "any active admin" access from direct API policies.
-- These policies must match the RBAC permissions enforced by the admin UI.

drop policy if exists "admin certificate writes can be audited by active admins" on public.audit_logs;
create policy "admin certificate writes can be audited by certificate admins"
on public.audit_logs for insert to authenticated
with check (
  public.admin_has_permission('admin.certificates.issue')
  and actor_role = 'admin'
  and entity_type = 'certificate'
  and action in (
    'admin_certificate_leadership_issued',
    'admin_certificate_live_project_issued',
    'admin_certificate_revoked'
  )
  and lower(coalesce(actor_email, '')) = public.current_auth_email()
);

drop policy if exists "admin cohort writes can be audited by active admins" on public.audit_logs;
create policy "admin cohort writes can be audited by cohort admins"
on public.audit_logs for insert to authenticated
with check (
  public.admin_has_permission('admin.cohorts.manage')
  and actor_role = 'admin'
  and entity_type = 'cohort'
  and action in (
    'admin_cohort_created',
    'admin_cohort_updated',
    'admin_cohort_status_changed'
  )
  and lower(coalesce(actor_email, '')) = public.current_auth_email()
);

drop policy if exists "admin program writes can be audited by active admins" on public.audit_logs;
create policy "admin program writes can be audited by program admins"
on public.audit_logs for insert to authenticated
with check (
  public.admin_has_permission('admin.programs.manage')
  and actor_role = 'admin'
  and entity_type = 'program'
  and action in (
    'admin_program_created',
    'admin_program_updated',
    'admin_program_status_changed'
  )
  and lower(coalesce(actor_email, '')) = public.current_auth_email()
);

drop policy if exists "admin project writes can be audited by active admins" on public.audit_logs;
create policy "admin project writes can be audited by project admins"
on public.audit_logs for insert to authenticated
with check (
  public.admin_has_permission('admin.projects.manage')
  and actor_role = 'admin'
  and entity_type in ('project', 'project_role')
  and action in (
    'admin_project_created',
    'admin_project_updated',
    'admin_project_status_changed',
    'admin_project_role_created',
    'admin_project_role_updated',
    'admin_project_role_status_changed'
  )
  and lower(coalesce(actor_email, '')) = public.current_auth_email()
);

drop policy if exists "admin resource writes can be audited by active admins" on public.audit_logs;
create policy "admin resource writes can be audited by resource admins"
on public.audit_logs for insert to authenticated
with check (
  public.admin_has_permission('admin.resources.manage')
  and actor_role = 'admin'
  and entity_type = 'resource'
  and action in (
    'admin_resource_created',
    'admin_resource_updated',
    'admin_resource_archived',
    'admin_resource_status_changed'
  )
  and lower(coalesce(actor_email, '')) = public.current_auth_email()
);

drop policy if exists "admin student writes can be audited by active admins" on public.audit_logs;
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
        'admin_student_lp_attempts_updated'
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

drop policy if exists "admin workshop writes can be audited by active admins" on public.audit_logs;
create policy "admin workshop writes can be audited by meeting admins"
on public.audit_logs for insert to authenticated
with check (
  actor_role = 'admin'
  and entity_type = 'workshop'
  and lower(coalesce(actor_email, '')) = public.current_auth_email()
  and (
    (
      public.admin_has_permission('admin.meetings.manage')
      and action in (
        'admin_workshop_created',
        'admin_workshop_updated',
        'admin_workshop_rescheduled',
        'admin_workshop_cancelled',
        'admin_workshop_status_changed'
      )
    )
    or (
      public.admin_has_permission('admin.recordings.manage')
      and action in (
        'admin_workshop_recording_updated',
        'admin_workshop_recordings_fetched',
        'admin_workshop_recording_published',
        'admin_workshop_recording_rejected'
      )
    )
  )
);

drop policy if exists "performance samples can be inserted by owner or admin" on public.audit_logs;
create policy "performance samples can be inserted by owner or observability admins"
on public.audit_logs for insert to authenticated
with check (
  action = 'performance_sample'
  and (
    public.admin_has_permission('admin.observability.view')
    or lower(coalesce(actor_email, '')) = public.current_auth_email()
  )
);

drop policy if exists "students create their own support tickets" on public.support_tickets;
create policy "students create their own support tickets"
on public.support_tickets for insert to authenticated
with check (
  public.admin_has_permission('admin.support.manage')
  or lower(student_email) = public.current_auth_email()
);

drop policy if exists "students read their support tickets and admins read all" on public.support_tickets;
create policy "students read their support tickets and support admins read all"
on public.support_tickets for select to authenticated
using (
  public.admin_has_permission('admin.support.view')
  or lower(student_email) = public.current_auth_email()
  or created_by_auth_user_id = auth.uid()
);
