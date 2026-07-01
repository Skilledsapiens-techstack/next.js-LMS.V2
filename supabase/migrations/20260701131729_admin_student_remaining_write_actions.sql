grant insert on table public.email_queue to authenticated;

drop policy if exists "admin student invite emails can be queued by active admins" on public.email_queue;

create policy "admin student invite emails can be queued by active admins"
on public.email_queue
for insert
to authenticated
with check (
  is_active_admin()
  and category = 'auth'
  and status = 'queued'
  and related_entity_type = 'student'
  and lower(coalesce(created_by, '')) = current_auth_email()
);

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
    'admin_student_created',
    'admin_student_updated',
    'admin_student_status_changed',
    'admin_student_invite_queued',
    'admin_student_lp_attempts_updated'
  )
  and lower(coalesce(actor_email, '')) = current_auth_email()
);
