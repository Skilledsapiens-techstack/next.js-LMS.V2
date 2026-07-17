# Hostinger Package - Sequence Workshop Title Dropdown

Prepared: 14 Jul 2026

## Included

- Latest production frontend build from `npm run build`.
- Recording Sequence Manager now uses the same workshop title dropdown list as Schedule Meeting.
- Schedule Meeting workshop topic dropdown remains unchanged.
- `Custom title` fallback remains available in Sequence Manager.
- SPA `.htaccess` rewrite file is included.

## QA Completed

- `npm run lint`
- `npm run build`
- `npm test -- --runInBand`
- Browser QA for Admin Recordings Sequence Manager and Admin Schedule Meeting.

## Deployment

Upload/extract the package contents into Hostinger `public_html` so that `index.html`, `.htaccess`, favicon files, and `assets/` are directly inside `public_html`.

## Backend

No Supabase migration or Edge Function deployment is required for this frontend-only dropdown refinement.
