# Skilled Sapiens LMS Hostinger Staging Package

Package: `lms-hostinger-staging-20260704-recording-lifecycle-layout-fix.zip`

Generated: 04 Jul 2026

## Includes

- Hostinger-ready `public_html` build files.
- SPA `.htaccess` routing and no-cache `index.html` behavior.
- Recording lifecycle changes:
  - Schedule Meeting: Upcoming, Needs Completion, Cancelled / Archived.
  - Recordings: Add Link, Pending Review, Published, Rejected.
  - Manual links enter review before student visibility.
- Schedule Meeting layout fixes:
  - Meeting List CTAs stay on one line.
  - Five KPI cards span the full horizontal page width.

## Already Applied To Supabase

- Edge Function redeploy: `zoom-meetings`
- Supabase project: `olgihgkyteumndphxsut`

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
