# LMS Hostinger Package - Admin Permissions Light UI

Prepared on 2026-07-06.

Includes:
- Latest production frontend build from `npm run build`.
- Admin Users module permission checkbox UI.
- Lighter Admin Users/RBAC typography.
- Existing Hostinger SPA `.htaccess`.

Backend already applied:
- Supabase migration `20260706072107_admin_user_custom_module_permissions.sql`.
- Supabase Edge Function `admin-users` deployed.

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- Production Supabase RLS/policy checks verified module permissions use `admin_has_permission`.
- Dry-run DB permission test confirmed custom Admin permissions allow selected modules and block Super Admin-only permissions.
