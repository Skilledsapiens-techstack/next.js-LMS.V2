# Skilled Sapiens LMS Staging Package

Package: `lms-hostinger-staging-20260703-support-mail-final`

## Deploy To Hostinger

1. Open Hostinger File Manager for `dev.skilledsapiens.com`.
2. Go to `public_html`.
3. Upload the contents of this package's `public_html` folder.
4. Keep the included `.htaccess` file in `public_html` for React route fallback.
5. Clear browser cache after upload if old assets still appear.

## Included In This Build

- Support module UI and workflow updates for student and admin views.
- Dynamic support categories and FAQ content from Supabase.
- Support ticket email delivery wired to the deployed `support-ticket-email` Edge Function.
- Admin reply email remains optional through the admin reply checkbox.
- Student ticket creation and student replies notify support/admin recipients without blocking the support action if email delivery is temporarily unavailable.

## Supabase Requirements

- The Supabase project must have the latest support migrations applied.
- The deployed `support-ticket-email` Edge Function must be present.
- Brevo credentials must stay configured only inside Supabase Edge Function secrets.
- Frontend package contains no service role key, Brevo key, or private email credentials.

## Verification Completed

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Real support email smoke test with `skilledsapiens@gmail.com`:
  - Created support ticket `SUP-TEST-1783092262557`.
  - Sent ticket-created email through Brevo.
  - Sent admin-reply email through Brevo.
  - Confirmed both events were logged as `sent` in `email_queue`.
