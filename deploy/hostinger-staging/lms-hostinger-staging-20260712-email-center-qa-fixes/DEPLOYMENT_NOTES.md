# Skilled Sapiens LMS - Email Centre QA Fixes

Generated: 12 Jul 2026

## Scope

- Email Centre quick filter QA fixes.
- Date range filters now update reliably from date input events.
- Student college options are deduped case-insensitively while keeping readable labels.
- Zero-recipient previews now show an exact zero-recipient summary instead of a generic Edge Function error.
- Transactional Email Supabase Edge Function deployed separately as `transactional-email` version 34.

## Verification

- `npm run lint` passed.
- `npm run build` passed.
- `git diff --check` passed.
- Browser QA passed for:
  - All active LMS students preview.
  - Filtered all-active preview.
  - Direct email preview.
  - Cohort student preview with zero recipients.
  - Cohort Google Group preview.

## Deploy

Upload the contents of this folder to Hostinger public web root.
