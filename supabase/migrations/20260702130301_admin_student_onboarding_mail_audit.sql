drop policy if exists "admin student writes can be audited by active admins" on public.audit_logs;

create policy "admin student writes can be audited by active admins"
on public.audit_logs
for insert
to authenticated
with check (
  is_active_admin()
  and actor_role = 'admin'
  and entity_type = 'student'
  and action in (
    'admin_student_auth_linked',
    'admin_student_created',
    'admin_student_updated',
    'admin_student_status_changed',
    'admin_student_invite_queued',
    'admin_student_onboarding_mail_queued',
    'admin_student_lp_attempts_updated'
  )
  and lower(coalesce(actor_email, '')) = current_auth_email()
);
