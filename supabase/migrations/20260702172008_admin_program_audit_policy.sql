drop policy if exists "admin program writes can be audited by active admins" on public.audit_logs;
create policy "admin program writes can be audited by active admins"
on public.audit_logs
for insert
to authenticated
with check (
  is_active_admin()
  and actor_role = 'admin'
  and entity_type = 'program'
  and action = any (array[
    'admin_program_created',
    'admin_program_updated',
    'admin_program_status_changed'
  ])
  and lower(coalesce(actor_email, '')) = current_auth_email()
);
