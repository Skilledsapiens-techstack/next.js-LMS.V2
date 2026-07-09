# Skilled Sapiens LMS - One Email One Portal

Prepared: 2026-07-07

## Included
- Latest frontend build under `public_html/`.
- Hostinger SPA `.htaccess` for client-side routing.

## Already Applied To Supabase
- Migration `20260707025813_enforce_one_email_one_portal_identity.sql`
  - Blocks the same email/auth user from being used as both Student and Admin.
- Edge Function `admin-users`
  - Adds clean Super Admin validation when trying to add an admin email already used by a student.

## Verification Completed
- `npm run lint`
- `npm run build`
- `npm test -- --runInBand`
- Remote migration list includes `20260707025813`.
- Remote triggers exist on `students` and `admin_users`.
- Duplicate student-to-admin and admin-to-student guard checks were blocked by the database.
