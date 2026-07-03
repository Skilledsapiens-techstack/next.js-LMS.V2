# Skilled Sapiens LMS Staging Package

Package: `lms-hostinger-staging-20260703-student-support-announcements-ui`

## Deploy To Hostinger

1. Open Hostinger File Manager for `dev.skilledsapiens.com`.
2. Go to `public_html`.
3. Upload the contents of this package's `public_html` folder.
4. Keep the included `.htaccess` file in `public_html` for React route fallback.
5. Clear browser cache after upload if older assets still appear.

## Included In This Build

- Student announcement filters are now compact dropdown filters.
- Student announcement cohort filter shows only cohorts the student belongs to.
- Bell announcement popup now closes by outside click or close button.
- Student support raise-query flow is cleaner, form-first, and removes disabled attachment UI.
- Student support success state now links directly to the created ticket.
- Latest support email integration and previous LMS module fixes remain included from the current build.

## Verification Completed

- `npm run lint`
- `npm run build`
