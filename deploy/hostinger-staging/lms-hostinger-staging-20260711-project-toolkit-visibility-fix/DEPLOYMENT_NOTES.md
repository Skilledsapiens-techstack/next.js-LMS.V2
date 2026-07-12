# LMS Hostinger Deployment Package - Project Toolkit Visibility Fix

Package date: 11 Jul 2026

## Issue fixed

Student Project Hub toolkit was hidden for some students because the toolkit API reads `student_programs` to match toolkit program mappings, but `student_programs` did not allow students to read their own rows.

## Supabase migration applied

Applied to remote Supabase:

- `20260711162522_student_own_programs_read_policy.sql`

This adds a narrow SELECT policy on `public.student_programs` so an authenticated student can read only their own program mappings.

## Verification

- `npm run lint` passed.
- `npm run build` passed.
- `supabase db push --dry-run` showed only the student-owned program read policy migration.
- `supabase db push` applied the migration.
- Remote policy check confirms `student programs readable by owning student` exists.
- Re-tested `caplexuscapital@gmail.com` locally:
  - Project Toolkit section appears.
  - Visible cards: Live Project Guidelines and How to Start your Project.
  - No browser console errors observed.

## Data note

`SOW Document Link` is currently inactive in Admin Project Toolkit, so it remains hidden from students by design.

## Deployment

Upload the contents of `public_html` to the Hostinger site root.
