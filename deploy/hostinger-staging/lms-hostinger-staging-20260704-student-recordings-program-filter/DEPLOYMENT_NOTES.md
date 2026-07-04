# Skilled Sapiens LMS - Hostinger Staging Package

Generated: 04 Jul 2026

## Package

This folder contains the production frontend build from `npm run build`.

Upload all files in this folder to the Hostinger staging site's `public_html` directory.

## Included frontend updates

- Student Recordings now includes an enrolled-program dropdown filter.
- Recording counts, pagination, and list results update based on the selected enrolled program.
- The program filter is client-side and uses already loaded visible recordings plus the student's enrolled cohort data.

## Backend notes

- Supabase Edge Functions and secrets are not included in this static frontend package.
- Keep all production/staging secrets configured only in Supabase.
- Do not upload `.env`, source files, Supabase secrets, or local temporary files.

## Hostinger upload reminder

- Replace the existing staging frontend files with this package content.
- Keep the domain pointed to the same Supabase project configuration already used by staging.
