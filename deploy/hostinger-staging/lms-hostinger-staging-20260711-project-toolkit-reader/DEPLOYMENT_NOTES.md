# LMS Hostinger Deployment Package - Project Toolkit Reader

Package date: 11 Jul 2026

## Included changes

- Student Project Hub toolkit cards now remain compact.
- Clicking a toolkit card opens a full-screen reader for only the selected toolkit item.
- Reader supports long RTE content with its own vertical scroll area.
- Reader locks background page scroll while open and restores it on close.
- Reader supports close button and Escape key close.
- SOW/toolkit external link action appears inside the reader after the written content.
- Existing student Project Hub project detail and submission flow are unchanged.
- Includes previous student labels:
  - Schedule -> Upcoming Workshops
  - Recordings -> Watch Recordings
  - Resources -> Resource Library

## Database state

No new Supabase migration is required for this UI-only reader update.

Previously applied toolkit migrations remain required:

- `20260711150113_project_toolkit_items.sql`
- `20260711152747_grant_project_toolkit_items_authenticated_access.sql`

## Verification

- `npm run lint` passed.
- `npm run build` passed.
- Student Project Hub QA:
  - Toolkit cards render compactly without inline expanded content.
  - Clicking Live Project Guidelines opens full-screen reader.
  - Clicking SOW Document Link opens the selected item reader.
  - SOW link/fallback appears inside the reader after content.
  - Clicking How to Start your Project opens the selected item reader.
  - Reader internal scroll is enabled for long content.
  - Background body scroll locks while reader is open and restores after close.
  - Close button works.
  - 375px mobile layout has no horizontal overflow.
  - Desktop layout uses a centered document-style reading page.
  - No browser console errors observed.

## Deployment

Upload the contents of `public_html` to the Hostinger site root.
