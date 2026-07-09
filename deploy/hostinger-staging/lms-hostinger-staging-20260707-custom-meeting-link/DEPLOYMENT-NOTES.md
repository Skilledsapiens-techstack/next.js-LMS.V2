# LMS Hostinger Package - Custom Meeting Link

Built on 2026-07-07 for the Schedule Meeting custom link release.

## Included

- Frontend production build from `npm run build`.
- Hostinger SPA rewrite file in `public_html/.htaccess`.
- Schedule Meeting UI now supports `Zoom Account 1`, `Zoom Account 2`, and `Custom Link`.

## Supabase

- No database migration required.
- `zoom-meetings` Edge Function deployed to Supabase and verified active as version 31.

## Verification

- `npm run lint`
- `npm run build`
- `npm test -- --runInBand`
- Remote `workshops` check constraints reviewed; `zoom_account` has no restrictive check constraint.
