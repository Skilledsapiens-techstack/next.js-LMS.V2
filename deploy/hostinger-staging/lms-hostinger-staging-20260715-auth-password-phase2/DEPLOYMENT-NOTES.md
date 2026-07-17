Hostinger deployment package

Package: `lms-hostinger-staging-20260715-auth-password-phase2`

Scope:
- Student password setup/reset Phase 2.
- Adds email-code fallback UI on expired/create password routes.
- Keeps normal login unchanged.
- Keeps admin expired password routes separate from student code recovery.
- Includes mobile auth layout hardening.

Backend:
- Supabase Edge Function `transactional-email` was deployed successfully as version 36.
- The email function now sends a safe LMS password page URL plus a one-time email code when Supabase provides `email_otp`.
- OTP values are rendered into email content but scrubbed from stored queue params.

Verification:
- `npm run build` passed.
- `npm run lint` passed.
- Local route QA passed for:
  - `/login`
  - `/login?mode=recovery&intent=create&portal=student&email=test%40example.com&otp_type=invite&auth_method=email_code`
  - `/login?mode=recovery&intent=forgot&portal=admin#error=access_denied&error_code=otp_expired`

Deploy:
- Upload the contents of `dist/` to Hostinger for the LMS frontend.
