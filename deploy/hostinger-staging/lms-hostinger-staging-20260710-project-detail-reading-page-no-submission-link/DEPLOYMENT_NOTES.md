# LMS Hostinger Staging Package - 2026-07-10

## Scope
- Keeps the live project detail page reading layout and rich text project content updates.
- Removes the old Admin Projects project-level "Submission link" input from the editor.
- Removes project-level `submission_link` from Admin Projects write allow-list so new project saves do not use that fallback path.
- Keeps the real portal submission workflow unchanged: students submit report links through the portal, and admin/student submission history can still open those submitted report links.

## Verification
- `npm run lint`
- `npm run build`
- `npm run test -- --runInBand`

## Upload Target
- Upload the contents of `public_html/` to Hostinger `public_html`.
