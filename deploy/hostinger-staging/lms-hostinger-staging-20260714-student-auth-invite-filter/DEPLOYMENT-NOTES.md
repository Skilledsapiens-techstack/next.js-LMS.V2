# LMS Hostinger Deployment - Student Auth & Invite Filter

Date: 14 Jul 2026

## Included

- Latest production build from `npm run build`.
- Admin Students:
  - Added compact Auth & Invite Status filter.
  - Bulk Resend invites remains available after selecting students.
  - Bulk resend now asks for confirmation.
  - Export Filtered respects the auth/invite filter.
  - Toolbar CTAs remain compact on one desktop row.
- Student Watch Recordings:
  - Recording metadata chips remain removed.
  - Step badges and recording sequencing remain intact.
- Existing Hostinger SPA `.htaccess` routing is included.

## Verification

- `git diff --check`
- `npm run lint`
- `npm run build`
- `npm test -- --runInBand`

