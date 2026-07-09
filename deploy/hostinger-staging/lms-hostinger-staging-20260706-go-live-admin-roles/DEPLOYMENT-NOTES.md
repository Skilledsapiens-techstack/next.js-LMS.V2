# Skilled Sapiens LMS Hostinger Package

Build: 2026-07-06 go-live lightweight admin roles

## Included

- Added lightweight admin roles: `Super Admin`, `Admin`, and `Moderator`.
- Existing active admins are preserved as `Super Admin`.
- Admin profile now returns normalized role and permissions.
- Admin sidebar and direct admin routes now respect role permissions.
- App data-layer checks now block restricted admin actions by role.

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
