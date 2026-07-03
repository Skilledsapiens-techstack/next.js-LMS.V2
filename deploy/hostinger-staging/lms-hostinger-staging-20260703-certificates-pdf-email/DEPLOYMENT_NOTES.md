# Skilled Sapiens LMS - Hostinger Staging Package

Package: `lms-hostinger-staging-20260703-certificates-pdf-email.zip`

## What Is Included

- Fresh Vite production build from the current LMS workspace.
- Updated Admin Certificates UI with explicit `Email PDF` action.
- Updated certificate client bundle for PDF generate/download/email flows.
- `.htaccess` for Hostinger SPA routing and asset caching.

## Upload Target

Upload the contents of `public_html/` into the Hostinger site document root for:

`https://dev.skilledsapiens.com/`

## Supabase Backend Already Updated

The required Supabase Edge Function changes were deployed separately:

- `certificate-issuance`
- `certificate-pdf-cleanup`

The certificate templates and temporary certificate storage are managed in Supabase private buckets. Do not upload certificate templates or secrets to Hostinger.

## After Deployment Checks

- Open `/login` directly and confirm the page loads after browser refresh.
- Login as admin and open `/admin/certificates`.
- Confirm issued certificate rows show `Generate PDF` / `Download PDF` and `Email PDF`.
- Login as a student and confirm certificate download works when a PDF is ready.

