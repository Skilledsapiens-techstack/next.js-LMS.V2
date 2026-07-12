# LMS Hostinger Deployment Package - Project Toolkit Audit Fix

Package date: 11 Jul 2026

## Included changes

- Includes latest Project Toolkit CTA UI polish and full-screen toolkit reader.
- Includes latest production build from `npm run build`.
- No frontend code change was required for the audit error.

## Supabase migration applied

Applied to remote Supabase:

- `20260711161604_project_toolkit_audit_policy.sql`

This updates the `audit_logs` insert RLS policy for project admins so toolkit saves can audit:

- `admin_project_toolkit_item_created`
- `admin_project_toolkit_item_updated`
- `admin_project_toolkit_item_status_changed`

Allowed audit `entity_type` now includes:

- `project_toolkit_item`

## Verification

- `npm run lint` passed.
- `npm run build` passed.
- `supabase db push --dry-run` showed only the audit policy migration.
- `supabase db push` applied the audit policy migration.
- Remote `pg_policies` verification confirms `project_toolkit_item` and toolkit audit actions are included.
- `supabase migration list` confirms local and remote include `20260711161604`.

## Deployment

Upload the contents of `public_html` to the Hostinger site root.
