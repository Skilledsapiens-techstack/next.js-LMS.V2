# LMS Hostinger Package - Custom Meeting Link Reviewed

Built on 2026-07-07 after regression review of Schedule Meeting and Recordings.

## Included

- Frontend production build from `npm run build`.
- Hostinger SPA rewrite file in `public_html/.htaccess`.
- Schedule Meeting supports `Zoom Account 1`, `Zoom Account 2`, and `Custom Link`.
- Cancel success message is generic for Zoom and custom-link meetings.

## Supabase

- No database migration required.
- `zoom-meetings` Edge Function already deployed and verified active as version 31.

## Verification

- `npm run lint`
- `npm run build`
- `npm test -- --runInBand`
- Remote migrations matched local migrations.
- Remote constraints reviewed for `workshops` and `workshop_recording_candidates`.
