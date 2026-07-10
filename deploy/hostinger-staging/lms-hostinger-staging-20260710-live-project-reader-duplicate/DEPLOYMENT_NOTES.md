# LMS Hostinger Staging Package - 2026-07-10

## Scope
- Adds Admin Projects duplicate draft action.
- Keeps duplicated projects unsaved until admin clicks Save Project.
- Duplicated project drafts get a new Project ID, `Copy of ...` title, and inactive status.
- Updates Student Live Project detail reader to use full page width when no Important Links exist.
- Includes previous live project reading-page updates and latest verified frontend build.

## Verification
- `npm run lint`
- `npm run build`
- `npm run test -- --runInBand`

## Upload Target
- Upload the contents of `public_html/` to Hostinger `public_html`.
