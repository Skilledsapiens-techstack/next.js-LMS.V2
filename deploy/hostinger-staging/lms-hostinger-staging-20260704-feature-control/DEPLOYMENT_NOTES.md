# Skilled Sapiens LMS Staging Package

Package: `lms-hostinger-staging-20260704-feature-control`

## Deploy To Hostinger

1. Open Hostinger File Manager for `dev.skilledsapiens.com`.
2. Go to `public_html`.
3. Upload the contents of this package's `public_html` folder.
4. Keep `.htaccess` inside `public_html` so direct page refresh works for app routes.
5. Clear browser cache after upload if old assets still appear.

## Included In This Build

- New Admin `Feature Control` module.
- Global student module visibility statuses: `Show`, `Upcoming`, and `Hide`.
- Dashboard is locked as always visible.
- Hidden student modules are removed from sidebar and blocked on direct URL access.
- Upcoming student modules stay in sidebar with a `Soon` badge and open a coming-soon screen.
- Optional upcoming message per controlled module.
- Announcement bell and banner hide when the Announcements module is hidden.
- Previous Payments & Access, Support, Announcements, and certificate updates remain included from the current build.

## Database

Remote Supabase migrations were applied through `supabase db push`.

Applied migration:

- `20260703190519_student_feature_control.sql`

Also applied previously pending support migrations:

- `20260703144018_support_phase_2_dynamic_faqs_notifications.sql`
- `20260703151537_support_email_direct_function_invocation.sql`

## Verification Completed

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Remote query confirmed 12 seeded `feature_controls` rows.
