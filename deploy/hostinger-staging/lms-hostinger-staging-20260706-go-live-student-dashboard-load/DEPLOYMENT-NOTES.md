# Skilled Sapiens LMS Hostinger Package

Package: `lms-hostinger-staging-20260706-go-live-student-dashboard-load`
Built on: 06 Jul 2026

## Scope

- First small post-live performance upgrade.
- Student dashboard now reuses the existing dashboard bundle for preview sections instead of firing separate preview requests for announcements, cohorts, recordings, schedule, resources, and locked resources.
- No database migration included.
- No Supabase Edge Function deployment included.
- No RLS or permission policy changes included in this package.

## Verification

- `npm run build` passed.
- Package contains the latest `dist` output under `public_html`.

## Deploy

Upload the contents of `public_html` to the Hostinger `public_html` directory for `login.skilledsapiens.com`.
