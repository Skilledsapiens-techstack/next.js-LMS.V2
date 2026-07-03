revoke insert, update, delete, truncate, references, trigger on table public.projects from anon;

drop policy if exists "admin project writes can be audited by active admins" on public.audit_logs;
create policy "admin project writes can be audited by active admins"
on public.audit_logs
for insert
to authenticated
with check (
  is_active_admin()
  and actor_role = 'admin'
  and entity_type in ('project', 'project_role')
  and action = any (array[
    'admin_project_created',
    'admin_project_updated',
    'admin_project_status_changed',
    'admin_project_role_created',
    'admin_project_role_updated',
    'admin_project_role_status_changed'
  ])
  and lower(coalesce(actor_email, '')) = current_auth_email()
);
