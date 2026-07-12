# LMS Hostinger Deployment Package - Favicon Update

Package date: 12 Jul 2026

## Included changes

- Adds Skilled Sapiens LMS favicon assets generated from the provided logo.
- Adds browser favicon links for `.ico`, 32x32 PNG, and 16x16 PNG.
- Adds Apple touch icon metadata for mobile/iOS bookmarks.
- Includes the latest app build state.

## Verification

- `npm run lint` passed.
- `npm run build` passed.
- Confirmed `dist/` includes:
  - `favicon.ico`
  - `favicon-32x32.png`
  - `favicon-16x16.png`
  - `apple-touch-icon.png`

## Database state

No Supabase migration is required for this change.

## Deployment

Upload the contents of `public_html` to the Hostinger site root.

After deployment, Chrome may keep the old favicon cached. A hard refresh or short wait may be needed before the browser tab icon updates.
