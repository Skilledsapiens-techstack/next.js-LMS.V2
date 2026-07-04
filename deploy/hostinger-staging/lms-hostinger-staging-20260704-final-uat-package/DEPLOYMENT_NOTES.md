# Skilled Sapiens LMS - Hostinger Staging Package

Generated: 04 Jul 2026

## Package

This folder contains the production frontend build from `npm run build`.

Upload all files in this folder to the Hostinger staging site's `public_html` directory.

## Included frontend updates

- Certificate module updates using the Google Slides certificate generation flow.
- Email Centre UI and template management updates.
- Recording, workshop cancellation, announcement, support, and cohort UI stability fixes.
- Latest student/admin portal UI and routing updates from the current workspace.

## Backend notes

- Supabase Edge Functions and secrets are not included in this static frontend package.
- Certificate generation depends on the already configured Supabase `certificate-issuance` function and Google Apps Script web app.
- Zoom, email, and certificate secrets must remain configured only in Supabase.

## Hostinger upload reminder

- Replace the existing staging frontend files with this package content.
- Keep the domain pointed to the same Supabase project configuration already used by staging.
- Do not upload `.env`, source files, Supabase secrets, or local temporary files.
