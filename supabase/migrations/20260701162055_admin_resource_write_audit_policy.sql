drop policy if exists "admin resource writes can be audited by active admins" on public.audit_logs;

create policy "admin resource writes can be audited by active admins"
on public.audit_logs
for insert
to authenticated
with check (
  is_active_admin()
  and actor_role = 'admin'
  and entity_type = 'resource'
  and action = any (array[
    'admin_resource_created',
    'admin_resource_updated',
    'admin_resource_archived',
    'admin_resource_status_changed'
  ])
  and lower(coalesce(actor_email, '')) = current_auth_email()
);
