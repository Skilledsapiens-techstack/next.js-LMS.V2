# Skilled Sapiens LMS Hostinger Package

Package: `lms-hostinger-staging-20260706-go-live-performance-optimized`
Built on: 06 Jul 2026

## Scope

- Latest post-live performance package.
- Includes student dashboard frontend request reduction.
- Supabase migration `20260706115911_optimize_student_dashboard_scope` has already been pushed to the linked Supabase project.
- No additional Supabase push is needed for this package.

## Verification

- `supabase migration list --linked` shows local and remote aligned through `20260706115911`.
- `npm run build` passed before packaging.
- Previous regression for this upgrade passed: lint, full Jest suite, Supabase sample checks, and production preview smoke.

## Deploy

Upload the contents of `public_html` to the Hostinger `public_html` directory for `login.skilledsapiens.com`.
