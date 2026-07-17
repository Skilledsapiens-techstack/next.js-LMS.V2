# Hostinger Package - Recording Sections

Prepared: 14 Jul 2026

## Included

- Latest production frontend build from `npm run build`.
- Admin Recording Sequence Manager now has a controlled `Section` dropdown:
  - Induction & Live Project Overview
  - Core Modules
  - Placement Mentorship
  - Other Workshops
- Student Watch Recordings now groups recordings by program and then by these sections.
- Within each section, sequenced recordings appear first by sequence number.
- Non-sequenced recordings follow oldest-to-newest within the same section.
- Existing sequence rules default to `Other Workshops` until edited by admin.
- SPA `.htaccess` rewrite file is included.

## Backend Applied

Applied Supabase migration:

- `20260714151027_recording_sequence_sections.sql`

This adds `recording_section` to `recording_sequence_rules` with a safe default of `other_workshops`.

## QA Completed

- `npm run lint`
- `npm run build`
- `npm test -- --runInBand`
- Remote DB verified for `recording_section` column/default and existing rule defaults.

## Deployment

Upload/extract the package contents into Hostinger `public_html` so that `index.html`, `.htaccess`, favicon files, and `assets/` are directly inside `public_html`.
