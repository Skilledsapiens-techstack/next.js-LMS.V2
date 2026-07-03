# Skilled Sapiens LMS Staging Package

Package: `lms-hostinger-staging-20260704-payments-access-support-ui`

## Deploy To Hostinger

1. Open Hostinger File Manager for `dev.skilledsapiens.com`.
2. Go to `public_html`.
3. Upload the contents of this package's `public_html` folder.
4. Keep `.htaccess` inside `public_html` so direct page refresh works for app routes.
5. Clear browser cache after upload if old assets still appear.

## Included In This Build

- Student Payments and Access merged into `Payments & Access`.
- `/student/access` redirects to `/student/payments`.
- Student Support raise-query flow cleaned up.
- Student Support FAQs now use compact accordions.
- Student Announcements filters and bell popup behavior updated.
- Previous support email integration and certificate/module fixes remain included from the current build.

## Verification Completed

- `npm run typecheck`
- `npm run lint`
- `npm run build`
