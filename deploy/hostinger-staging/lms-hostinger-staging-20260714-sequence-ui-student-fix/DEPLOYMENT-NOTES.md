# Hostinger Package - Sequence UI and Student Visibility Fix

Prepared: 14 Jul 2026

## Included

- Latest production frontend build from `npm run build`.
- Admin Recording Sequence Manager layout spacing cleanup so the multi-program selector is less congested.
- Sequence matching now supports longer scheduled workshop titles matching shorter published recording titles.
- Student recording sequence enrichment now also uses enrolled program data as a fallback when recording rows do not carry direct program metadata.
- SPA `.htaccess` rewrite file is included.

## QA Completed

- `npm run lint`
- `npm run build`
- `npm test -- --runInBand`
- Verified live sequence rule data exists for the affected program/title pattern.

## Deployment

Upload/extract the package contents into Hostinger `public_html` so that `index.html`, `.htaccess`, favicon files, and `assets/` are directly inside `public_html`.

## Backend

No new Supabase migration or Edge Function deployment is required for this package. It uses the existing `recording_sequence_rules` table.
