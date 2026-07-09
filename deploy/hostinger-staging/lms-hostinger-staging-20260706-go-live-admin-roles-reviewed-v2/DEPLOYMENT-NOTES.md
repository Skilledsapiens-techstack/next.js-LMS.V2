# Skilled Sapiens LMS Hostinger Package

Build: 2026-07-06 go-live lightweight admin roles, reviewed v2

## Included

- Added lightweight admin roles: `Super Admin`, `Admin`, and `Moderator`.
- Existing active admins are preserved as `Super Admin`.
- Admin profile returns normalized role and compact permissions.
- Admin sidebar and direct admin routes respect role permissions.
- Backend data-layer checks block restricted admin reads/writes/actions by role.
- Students page CTAs now hide restricted actions for view-only roles.
- Certificates page hides issuance, revoke, email-PDF, and final issuance actions unless the role can issue certificates.
- Student certificate download path remains available to students.
- Email Centre sending now checks email permission instead of student permission.
- `admin-students` Edge Function permissions now distinguish read-only status/health checks from write actions.
- Moderator navigation is narrowed to safe/useful modules to avoid confusing write-only UI on broader admin pages.
- Admin dashboard drilldowns now skip modules the role cannot view, so limited roles do not get dashboard load failures.

## Database

Applied Supabase migration:

- `20260706013000_lightweight_admin_roles.sql`

Production verification:

- Active admins: `2`
- Active `super_admin` admins: `2`
- `admin_users_role_check` allows `super_admin`, `admin`, and `moderator`.

## Verification

- `npm run lint`
- `npm run build`
