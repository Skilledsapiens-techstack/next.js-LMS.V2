# Skilled Sapiens LMS Hostinger Staging Package

Package: `lms-hostinger-staging-20260704-email-center-formatting.zip`

## What Is Included

- Latest production frontend build from `npm run build`
- Hostinger-ready `public_html` contents
- `.htaccess` rewrite rules for React/Vite client-side routes
- Latest Email Centre and system email template formatting updates

## Upload Steps

1. Open Hostinger File Manager for `dev.skilledsapiens.com`.
2. Go to `public_html`.
3. Upload the zip file.
4. Extract it so the contents of `public_html` inside this package replace the site files.
5. Confirm `public_html/index.html`, `public_html/.htaccess`, and `public_html/assets/` exist at the domain root.

## Already Applied Separately

- Supabase migration `20260704081200_email_system_template_formatting.sql`
- Supabase Edge Function redeploy: `transactional-email`

## Verification

- `npm run build` completed successfully.
- A real onboarding template email test was sent successfully to `skilledsapiens@gmail.com`.
