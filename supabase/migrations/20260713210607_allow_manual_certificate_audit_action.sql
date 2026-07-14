-- Allow the additive manual certificate issuer to write a distinct audit trail.
-- Existing certificate issuance/revoke actions remain unchanged.

drop policy if exists "admin certificate writes can be audited by certificate admins" on public.audit_logs;

create policy "admin certificate writes can be audited by certificate admins"
on public.audit_logs
for insert
to authenticated
with check (
  public.admin_has_permission('admin.certificates.issue')
  and actor_role = 'admin'
  and entity_type = 'certificate'
  and action in (
    'admin_certificate_leadership_issued',
    'admin_certificate_live_project_issued',
    'admin_certificate_manual_issued',
    'admin_certificate_revoked'
  )
  and lower(coalesce(actor_email, '')) = public.current_auth_email()
);
