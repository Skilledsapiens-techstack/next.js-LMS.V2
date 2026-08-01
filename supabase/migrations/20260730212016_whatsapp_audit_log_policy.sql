grant insert on table public.audit_logs to authenticated;

drop policy if exists "admin whatsapp writes can be audited by community admins" on public.audit_logs;
create policy "admin whatsapp writes can be audited by community admins"
on public.audit_logs for insert to authenticated
with check (
  public.admin_has_permission('admin.community.manage')
  and actor_role = 'admin'
  and entity_type in (
    'whatsapp_groups',
    'whatsapp_message_categories',
    'whatsapp_message_templates',
    'whatsapp_message_logs'
  )
  and action in (
    'admin_whatsapp_groups_created',
    'admin_whatsapp_groups_updated',
    'admin_whatsapp_message_categories_created',
    'admin_whatsapp_message_categories_updated',
    'admin_whatsapp_message_templates_created',
    'admin_whatsapp_message_templates_updated',
    'admin_whatsapp_message_logs_created',
    'admin_whatsapp_message_logs_updated'
  )
  and lower(coalesce(actor_email, '')) = public.current_auth_email()
);
