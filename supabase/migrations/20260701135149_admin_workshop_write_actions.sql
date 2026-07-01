grant insert, update on table public.workshops to authenticated;
grant insert on table public.audit_logs to authenticated;

drop policy if exists "workshops writable by active admins" on public.workshops;

create policy "workshops writable by active admins"
on public.workshops
for insert
to authenticated
with check (is_active_admin());

drop policy if exists "workshops updateable by active admins" on public.workshops;

create policy "workshops updateable by active admins"
on public.workshops
for update
to authenticated
using (is_active_admin())
with check (is_active_admin());

drop policy if exists "admin workshop writes can be audited by active admins" on public.audit_logs;

create policy "admin workshop writes can be audited by active admins"
on public.audit_logs
for insert
to authenticated
with check (
  is_active_admin()
  and actor_role = 'admin'
  and entity_type = 'workshop'
  and action in (
    'admin_workshop_created',
    'admin_workshop_updated',
    'admin_workshop_status_changed',
    'admin_workshop_recording_updated'
  )
  and lower(coalesce(actor_email, '')) = current_auth_email()
);
