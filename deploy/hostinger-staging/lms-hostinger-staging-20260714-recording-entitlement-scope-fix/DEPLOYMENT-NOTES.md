# Hostinger Package - Recording Entitlement Scope Fix

Prepared: 14 Jul 2026

## Included

- Latest production frontend build from `npm run build`.
- Student recordings defensively hide rows that do not have any explicit program or cohort audience.
- Student recording program chips now come from the learner's enrolled cohorts/programs, not from returned recording rows.
- Fallback label changed from `General Recordings` to `Additional Recordings`.
- SPA `.htaccess` rewrite file is included.

## Backend Applied

Applied Supabase migration:

- `20260714142547_require_student_workshop_audience_scope.sql`

The live `student_dashboard_bundle` function now requires student-visible workshop rows to have at least one explicit program or cohort audience.

## QA Completed

- `npm run lint`
- `npm run build`
- `npm test -- --runInBand`
- Verified remote function contains the strict audience-scope condition.

## Deployment

Upload/extract the package contents into Hostinger `public_html` so that `index.html`, `.htaccess`, favicon files, and `assets/` are directly inside `public_html`.
