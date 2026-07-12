# LMS Hostinger Deployment Package - Project Toolkit + Student Labels

Package date: 11 Jul 2026

## Included changes

- Admin Projects: Project Hub Global Sections toolkit manager.
- Student Project Hub: global toolkit section with Live Project Guidelines, SOW Document Link, and How to Start your Project (4-week Framework).
- Student Project Hub: toolkit section stays hidden if the toolkit API fails.
- Student Project Hub: responsive fix so toolkit cards stack properly on 375px mobile screens.
- Student portal labels:
  - Schedule -> Upcoming Workshops
  - Recordings -> Watch Recordings
  - Resources -> Resource Library

## Database state

The required Supabase migrations for the project toolkit were already applied:

- `20260711150113_project_toolkit_items.sql`
- `20260711152747_grant_project_toolkit_items_authenticated_access.sql`

No new migration is required for the label-only or mobile CSS updates.

## Verification

- `npm run lint` passed.
- `npm run build` passed.
- Student Project Hub QA:
  - Toolkit visible at desktop.
  - Toolkit visible at 375px.
  - Toolkit cards stack cleanly at 375px.
  - Project submission section remains visible.
  - No page-level horizontal overflow.
  - No browser console errors observed.
- Admin Projects QA:
  - Toolkit manager visible at desktop and 375px.
  - Toolkit items and program mapping controls visible.
  - No page-level horizontal overflow.
  - No browser console errors observed.

## Deployment

Upload the contents of `public_html` to the Hostinger site root.
