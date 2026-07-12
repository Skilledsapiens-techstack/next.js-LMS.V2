drop policy if exists "admin project writes can be audited by project admins" on public.audit_logs;
create policy "admin project writes can be audited by project admins"
on public.audit_logs for insert to authenticated
with check (
  public.admin_has_permission('admin.projects.manage')
  and actor_role = 'admin'
  and entity_type in ('project', 'project_role', 'project_toolkit_item')
  and action in (
    'admin_project_created',
    'admin_project_updated',
    'admin_project_status_changed',
    'admin_project_role_created',
    'admin_project_role_updated',
    'admin_project_role_status_changed',
    'admin_project_toolkit_item_created',
    'admin_project_toolkit_item_updated',
    'admin_project_toolkit_item_status_changed'
  )
  and lower(coalesce(actor_email, '')) = public.current_auth_email()
);
