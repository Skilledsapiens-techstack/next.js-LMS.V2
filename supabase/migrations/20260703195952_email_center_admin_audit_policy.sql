drop policy if exists "email center audit logs can be inserted by active admins" on public.audit_logs;

create policy "email center audit logs can be inserted by active admins"
on public.audit_logs
for insert
to authenticated
with check (
  public.is_active_admin()
  and entity_type in ('email_template', 'email_center')
  and action in (
    'admin_email_template_created',
    'admin_email_template_updated',
    'admin_email_template_archived',
    'admin_email_center_sent'
  )
  and lower(coalesce(actor_email, '')) = public.current_auth_email()
);
