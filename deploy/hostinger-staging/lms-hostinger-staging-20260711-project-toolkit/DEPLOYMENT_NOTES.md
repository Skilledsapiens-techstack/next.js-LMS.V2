# LMS Hostinger Staging Package - 2026-07-11

## Scope
- Adds Admin Projects toolkit management for Project Hub global/program-mapped items.
- Seeds support for Live Project Guidelines, SOW Document Link, and How to Start your Project (4-week Framework).
- Adds Student Project Hub toolkit rendering with accordion cards and formatted content.
- Hides the student toolkit section if the toolkit API/table fails, so existing Project Hub and submission flow continue loading.
- Keeps existing project detail, visibility, and submission flows unchanged.

## Required Database Step
- Apply `supabase/migrations/20260711150113_project_toolkit_items.sql` before or alongside the frontend deployment.
- Apply `supabase/migrations/20260711152747_grant_project_toolkit_items_authenticated_access.sql` so authenticated admins/students can reach the new table through the Supabase Data API while RLS still controls row/action access.
- Both migrations have been applied to the linked Supabase project in this workspace.
- If the table migration is missing, Admin Projects shows an isolated toolkit-unavailable notice and Student Project Hub hides the toolkit section.

## Verification
- `npm run build`
- `npm test -- --runInBand`
- `npm run lint`
- Local rendered checks:
  - Admin Projects desktop and 375px mobile: no horizontal overflow, toolkit visible after migration, Live Project Library still visible.
  - Student Project Hub desktop and 375px mobile: no horizontal overflow, toolkit visible after migration, project submission history still visible.

## Upload Target
- Upload the contents of `public_html/` to Hostinger `public_html`.
