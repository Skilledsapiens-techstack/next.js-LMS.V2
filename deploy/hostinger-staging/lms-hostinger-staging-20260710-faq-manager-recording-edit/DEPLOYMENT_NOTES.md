# LMS Hostinger Staging Package - FAQ Manager + Recording Edit

Build date: 2026-07-10

## Contents

- `public_html/` contains the production frontend build from `npm run build`.
- Includes the Admin FAQ Manager UI update:
  - accordion FAQ list
  - category and status filters
  - scrollable FAQ list area
  - inline add/edit form
  - edit and hard-delete confirmation CTAs
  - hover, press, disabled, and loading states
- Includes the Admin Published Recording edit UI already implemented in this workspace.

## Backend Notes

- No new Supabase Edge Function deployment was required for the FAQ UI package.
- FAQ hard delete uses the existing Supabase client/API adapter path with admin support manage permission.
- Previously deployed `zoom-meetings` Edge Function remains active at version 33 for published recording edits.

## Verification

- `npm run build` passed.
- `npm run lint` passed during the FAQ regression pass.
- FAQ UI regression checked at 1440, 1024, 834, 768, and 375px.
- No FAQ save/add/delete action was performed during QA.
