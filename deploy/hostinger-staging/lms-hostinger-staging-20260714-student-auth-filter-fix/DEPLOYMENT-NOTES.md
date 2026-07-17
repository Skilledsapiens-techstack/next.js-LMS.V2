# Hostinger Deployment Notes

Package: `lms-hostinger-staging-20260714-student-auth-filter-fix`

Included fix:
- Admin Students auth/invite dropdown no longer takes the Students module to the unavailable screen when auth status enrichment fails.
- Auth status lookup now degrades safely to stored roster data where available.
- Students page no longer blocks rendering on the large auth-status enrichment request for filtered views.

Verification completed:
- `git diff --check`
- `npm run lint`
- `npm run build`
- `npm test -- --runInBand`
- Local browser smoke test for Admin Students auth/invite filter URLs and actual dropdown selection.

Deployment:
- Upload the contents of this folder to Hostinger `public_html`.
- Keep the included `.htaccess` for SPA route refresh support.
