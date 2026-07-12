# LMS Hostinger Deployment Package - Email Recipient Filters

Package date: 12 Jul 2026

## Included changes

- Adds Email Centre quick filters for student recipient targeting:
  - Program
  - Cohort
  - College
  - Education Year
  - Onboarding Date range
  - Auth & Invite Status
  - Live Project Role
  - Paid Access Status
- Applies filters only to student-recipient modes:
  - All active LMS students
  - All students in selected cohort
- Keeps direct manual emails and Cohort Google Group mode unchanged.
- Preview and final send use the same filtered recipient resolver.
- Includes the latest app build state, including favicon assets.

## Edge Function

`transactional-email` was deployed successfully after the resolver update.

## Verification

- `npm run lint` passed.
- `npm run build` passed.
- `git diff --check` passed.

Local Deno CLI is not installed, so `deno check` could not be run for the Edge Function file.

## Database state

No Supabase migration is required for this change.

## Deployment

Upload the contents of `public_html` to the Hostinger site root.
