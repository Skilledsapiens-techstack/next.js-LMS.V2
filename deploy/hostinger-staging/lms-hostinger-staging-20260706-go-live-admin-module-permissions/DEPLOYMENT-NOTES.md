# Skilled Sapiens LMS Hostinger Package

Build: 2026-07-06 go-live admin module permissions

## Included

- Admin Users form now includes module permission checkboxes.
- Super Admin can save tailored permissions while adding/updating Admin or Moderator accounts.
- Super Admin always keeps full LMS access.
- Existing admins with no saved custom permissions continue using their role defaults.
- Sidebar, direct admin routes, dashboard drilldowns, and page CTAs use the saved permission list.
- Hostinger SPA rewrite file included at `public_html/.htaccess`.

## Supabase Already Applied

- `20260706072107_admin_user_custom_module_permissions.sql`

## Edge Functions Already Deployed

- `admin-users`

## Verification

- Custom Admin direct DB permission simulation passed.
- Default Admin fallback simulation passed.
- `npm run lint`
- `npm run build`
