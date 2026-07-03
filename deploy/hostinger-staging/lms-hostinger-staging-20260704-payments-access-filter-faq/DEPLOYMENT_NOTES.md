# Skilled Sapiens LMS Staging Package

Package: `lms-hostinger-staging-20260704-payments-access-filter-faq`

## Deploy To Hostinger

1. Open Hostinger File Manager for `dev.skilledsapiens.com`.
2. Go to `public_html`.
3. Upload the contents of this package's `public_html` folder.
4. Keep `.htaccess` inside `public_html` so direct page refresh works for app routes.
5. Clear browser cache after upload if old assets still appear.

## Included In This Build

- Student Payments & Access filters are now dropdown driven.
- Removed the Payments & Access search bar for a cleaner compact viewport.
- Support FAQs now use a clear accordion chevron indicator instead of plus/minus.
- Previous support, announcements, certificate, and payment/access updates remain included from the current build.

## Verification Completed

- `npm run typecheck`
- `npm run lint`
- `npm run build`
