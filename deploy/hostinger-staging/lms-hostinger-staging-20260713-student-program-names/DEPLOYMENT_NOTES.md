# LMS Hostinger Deployment - Student Program Names

Date: 2026-07-13

## Change

- Student "My Programs" cards now use the full program name from the Supabase `programs` catalog.
- Fixes `flp_er` displaying as `Flp Er`; it will display `Finance Leadership Program - ER`.
- Removes the stale frontend hardcoded program display map so future program keys can use catalog names automatically.

## Verification

- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Deploy

Upload the contents of this folder to Hostinger `public_html`.
