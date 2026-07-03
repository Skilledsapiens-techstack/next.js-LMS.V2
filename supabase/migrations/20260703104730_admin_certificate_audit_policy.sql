grant insert on table public.audit_logs to authenticated;

drop policy if exists "admin certificate writes can be audited by active admins" on public.audit_logs;

create policy "admin certificate writes can be audited by active admins"
on public.audit_logs
for insert
to authenticated
with check (
  public.is_active_admin()
  and actor_role = 'admin'
  and entity_type = 'certificate'
  and action = any (array[
    'admin_certificate_leadership_issued',
    'admin_certificate_live_project_issued',
    'admin_certificate_revoked'
  ])
  and lower(coalesce(actor_email, '')) = public.current_auth_email()
);
