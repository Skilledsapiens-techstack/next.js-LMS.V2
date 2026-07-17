drop policy if exists "admin student writes can be audited by student admins" on public.audit_logs;

create policy "admin student writes can be audited by student admins"
on public.audit_logs for insert to authenticated
with check (
  actor_role = 'admin'
  and entity_type = 'student'
  and lower(coalesce(actor_email, '')) = public.current_auth_email()
  and (
    (
      public.admin_has_permission('admin.students.view')
      and action in (
        'admin_student_preview_started'
      )
    )
    or (
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
