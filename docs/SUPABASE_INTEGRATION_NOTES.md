# Supabase Integration Notes

## Phase 1: Admin Access Policy Migration

Status: completed locally on 2026-07-01.

Migration:

- `supabase/migrations/20260701095146_admin_access_policies.sql`

Captured live database fixes:

- Enabled RLS for `public.admin_users`.
- Enabled RLS for `public.workshop_recording_candidates`.
- Granted `authenticated` role `SELECT` access on both tables.
- Added an idempotent active admin self-profile read policy for `admin_users`.
- Added an idempotent active admin read policy for `workshop_recording_candidates`.

Verification completed:

- Remote linked Supabase project has both expected RLS policies.
- Remote linked Supabase project has both expected `authenticated` `SELECT` grants.
- `npm run typecheck` passes.

## Follow-Up: Security Advisor Findings

Supabase security advisors reported existing project warnings that are outside the narrow Phase 1 migration scope.

Important follow-up for RLS hardening:

- Several `SECURITY DEFINER` functions in `public` are executable through the Data API.
- `public.is_active_admin()` is included in that warning set.
- This should be reviewed before expanding admin/student access or enabling more write paths.

Recommended next action:

- Audit public `SECURITY DEFINER` functions.
- Revoke `EXECUTE` from `anon` where not required.
- Restrict `authenticated` execution to intentional RPCs only.
- Prefer moving internal privileged helpers out of exposed schemas or tightening function grants.
- Ensure security-definer functions set an explicit `search_path`.

## Phase 3: Admin Read Route Smoke Test

Status: started locally on 2026-07-01.

Browser smoke-tested admin read routes:

- `/admin`
- `/admin/recording-candidates`
- `/admin/workshops`
- `/admin/resources`
- `/admin/students`
- `/admin/cohorts`
- `/admin/programs`
- `/admin/projects`
- `/admin/project-submissions`
- `/admin/certificates`
- `/admin/enrollments`
- `/admin/announcements`
- `/admin/support`
- `/admin/payment-orders`
- `/admin/paid-access`

Fixes applied:

- Student status filters now target boolean `students.active`.
- Support category filters now target `support_tickets.category_name`.
- Resource search no longer references nonexistent `resources.program_key`.
- Project role search uses `role_master.role_name` and `role_master.role_category`.
- Project role rows are normalized for UI fields `name` and `category`.
- Sentinel filter value `any` is ignored like `all`.
- Project-submission `pending` maps to source status `submitted`.
- Project-submission date filters target `submitted_at`.

Verified in browser:

- Admin route sweep showed no active "Unable to load" states on live admin screens.
- Students Active/Inactive status filters load without errors.
- Project role selector loads role labels from Supabase.
- Resource search loads without errors.

Remaining follow-up:

- Project-submission `duplicates` needs a product/data model decision; the current table does not expose duplicate-group columns.
- Resource program filtering needs a proper array-field strategy for `resources.program_keys`.
