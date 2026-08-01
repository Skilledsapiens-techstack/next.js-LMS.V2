drop policy if exists "whatsapp categories readable by community admins" on public.whatsapp_message_categories;
create policy "whatsapp categories readable by community admins"
on public.whatsapp_message_categories for select to authenticated
using (public.admin_has_permission('admin.community.view'));

drop policy if exists "whatsapp groups readable by community admins" on public.whatsapp_groups;
create policy "whatsapp groups readable by community admins"
on public.whatsapp_groups for select to authenticated
using (public.admin_has_permission('admin.community.view'));

drop policy if exists "whatsapp templates readable by community admins" on public.whatsapp_message_templates;
create policy "whatsapp templates readable by community admins"
on public.whatsapp_message_templates for select to authenticated
using (public.admin_has_permission('admin.community.view'));

drop policy if exists "whatsapp logs readable by community admins" on public.whatsapp_message_logs;
create policy "whatsapp logs readable by community admins"
on public.whatsapp_message_logs for select to authenticated
using (public.admin_has_permission('admin.community.view'));
