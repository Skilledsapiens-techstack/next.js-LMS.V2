# Skilled Sapiens LMS Hostinger Staging Package

Package: `lms-hostinger-staging-20260704-meeting-cancel-fix-v2.zip`

Generated: 04 Jul 2026

## Includes

- Hostinger-ready `public_html` build files.
- SPA `.htaccess` routing and no-cache `index.html` behavior.
- Meeting cancellation fix: LMS cancellation now clears the student join link and marks the workshop cancelled even if Zoom delete fails.
- Admin cancellation feedback now distinguishes full Zoom cancellation from LMS-only cancellation with a Zoom warning.
- Edge Function error handling improvement: real function errors are shown instead of only the generic wrapper message.

## Already Applied To Supabase

- Edge Function redeploy: `zoom-meetings`

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
- If a browser has an old build cached, refresh once after deployment.
