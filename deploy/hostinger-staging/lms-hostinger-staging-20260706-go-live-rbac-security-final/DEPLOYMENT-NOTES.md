# Skilled Sapiens LMS Hostinger Package

Build: 2026-07-06 go-live RBAC security final

## Included

- Latest frontend build after RBAC and security hardening.
- Admin roles: `Super Admin`, `Admin`, and `Moderator`.
- Admin sidebar and direct admin routes respect role permissions.
- Community admin route now has explicit permission gating.
- Admin Students, Certificates, Dashboard, Email Centre, Feature Control, and Admin Users UI reflect latest role restrictions.
- Hostinger SPA rewrite file included at `public_html/.htaccess`.

## Supabase Already Applied

These database migrations were already pushed to Supabase before this package was prepared:

- `20260706013000_lightweight_admin_roles.sql`
- `20260706053418_admin_role_hardening.sql`
- `20260706062006_fix_admin_role_lookup_recursion.sql`
- `20260706062223_harden_email_queue_read_access.sql`
- `20260706062508_harden_admin_direct_write_policies.sql`
- `20260706063030_harden_remaining_admin_audit_support_policies.sql`
- `20260706063749_harden_remaining_legacy_active_admin_policies.sql`
- `20260706064547_lock_down_legacy_active_admin_function_execute.sql`
- `20260706065034_revoke_unneeded_public_table_privileges.sql`
- `20260706065316_revoke_student_row_delete_from_browser_role.sql`

## Verification

- `npm run lint`
- `npm run build`
- Supabase role checks passed for Super Admin, Admin, Moderator, inactive admin, and non-admin.
- Public tables have RLS enabled.
- No frontend service-role/secret reference found.
- `anon` has no write or maintenance grants.
