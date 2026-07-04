# Skilled Sapiens LMS Hostinger Staging Package

Package: `lms-hostinger-staging-20260704-uat-stability.zip`

Generated: 04 Jul 2026

## Includes

- Hostinger-ready `public_html` build files.
- SPA `.htaccess` routing and no-cache `index.html` behavior.
- UAT stability fixes for auth copy, announcement priority, recording candidates, recording passcodes, support tabs, and route chunk-load fallback.

## Already Applied To Supabase

- Migration: `20260704143500_zoom_recording_passwords.sql`
- Edge Function redeploy: `zoom-meetings`
- Edge Function redeploy: `certificate-issuance`

## Hostinger Upload Steps

1. Open Hostinger File Manager for `dev.skilledsapiens.com`.
2. Go to the site `public_html` directory.
3. Upload this zip file.
4. Extract it so the contents of `public_html/` inside this package replace the current site files.
5. Confirm these exist at domain root after extraction:
   - `index.html`
   - `.htaccess`
   - `assets/`

## Notes

- Upload hidden files too. `.htaccess` is required for direct route reloads.
- If a user sees a page-update message after deployment, ask them to click refresh once. This clears old hashed module references from the previous deployment.
