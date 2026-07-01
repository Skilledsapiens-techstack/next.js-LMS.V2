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
    'admin_workshop_rescheduled',
    'admin_workshop_cancelled',
    'admin_workshop_status_changed',
    'admin_workshop_recording_updated',
    'admin_workshop_recordings_fetched',
    'admin_workshop_recording_published'
  )
  and lower(coalesce(actor_email, '')) = current_auth_email()
);
