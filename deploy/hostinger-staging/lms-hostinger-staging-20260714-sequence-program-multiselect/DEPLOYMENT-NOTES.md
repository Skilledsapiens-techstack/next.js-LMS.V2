# Hostinger Package - Recording Sequence Program Multi-Select

Prepared: 14 Jul 2026

## Included

- Latest production frontend build from `npm run build`.
- Admin Recordings Sequence Manager now supports selecting multiple programs with checkboxes.
- Sequence Manager keeps the shared workshop title dropdown from Schedule Meeting.
- `Select all`, `Clear`, validation, duplicate-skip messaging, and custom title fallback are included.
- SPA `.htaccess` rewrite file is included.

## QA Completed

- `npm run lint`
- `npm run build`
- `npm test -- --runInBand`
- Browser QA for Admin Recordings Sequence Manager.
- Responsive QA at 1440, 1024, 768, and 375.

## Deployment

Upload/extract the package contents into Hostinger `public_html` so that `index.html`, `.htaccess`, favicon files, and `assets/` are directly inside `public_html`.

## Backend

No Supabase migration or Edge Function deployment is required for this frontend-only workflow update.
