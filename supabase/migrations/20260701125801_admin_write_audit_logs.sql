grant insert on table public.audit_logs to authenticated;

drop policy if exists "admin cohort writes can be audited by active admins" on public.audit_logs;

create policy "admin cohort writes can be audited by active admins"
on public.audit_logs
for insert
to authenticated
with check (
  is_active_admin()
  and actor_role = 'admin'
  and entity_type = 'cohort'
  and action in (
    'admin_cohort_created',
    'admin_cohort_updated',
    'admin_cohort_status_changed'
  )
  and lower(coalesce(actor_email, '')) = current_auth_email()
);
