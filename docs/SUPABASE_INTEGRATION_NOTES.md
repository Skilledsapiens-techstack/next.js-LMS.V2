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

## Phase 4: Student Read Integration Hardening

Status: started locally on 2026-07-01.

Code fixes applied:

- RPC-backed student list responses now apply query filters after row normalization.
- `/students/me/announcements` honors `priority`.
- `/students/me/cohorts` honors `status`.
- `/students/me/recordings` honors `accessType` and `source`.
- `/students/me/schedule` honors `accessType` and `status`.
- `/students/me/resources` honors `accessType` and `resourceType`.
- `/students/me/projects` honors `programKey` and `roleId`.

Supabase audit findings:

- Active linked student Auth users exist for browser QA.
- Student RPCs are executable by `authenticated`, `postgres`, and `service_role`.
- Student RPCs are `SECURITY DEFINER`, but they use helper functions that resolve authenticated requests from the JWT email instead of trusting `p_student_email`.
- `service_role` can still pass `p_student_email`, which is appropriate only for server/admin access.
- `student_resources_view` nulls locked paid-resource URLs before returning data.

Remaining follow-up:

- Browser-smoke the student portal with a real student session.
- Include the student RPCs in the broader `SECURITY DEFINER` hardening phase.

## Phase 5: Student RPC Helper Hardening

Status: completed locally and applied to the linked project on 2026-07-01.

Migration:

- `supabase/migrations/20260701102314_harden_student_rpc_request_email.sql`

Fix applied:

- Replaced deprecated `auth.role()` usage inside `public.lms_request_email()`.
- Preserved the existing access model:
  - `service_role` may pass `p_student_email` for server/admin lookups.
  - Browser/authenticated calls resolve from the caller JWT email.
- Kept the helper as `STABLE SECURITY DEFINER`.
- Kept explicit `search_path` as `public, auth`.

Verification completed:

- Linked project function definition no longer contains `auth.role()`.
- No ordinary `public` functions currently contain `auth.role()`.
- Supabase advisors still report broader existing `SECURITY DEFINER` and mutable `search_path` warnings for other functions; those remain separate hardening work.

## Phase 6: Student Browser QA And RLS Read Policies

Status: completed locally and applied to the linked project on 2026-07-01.

Test account:

- `skilledsapiens@gmail.com`

Migration:

- `supabase/migrations/20260701161458_student_owned_read_policies.sql`

Fixes applied:

- Added student-owned select policies for:
  - `students`
  - `certificates`
  - `paid_access`
  - `payment_orders`
  - `project_submission_requests`
- Kept existing admin policies unchanged.
- Fixed login portal resolution so student login checks `/students/me` before `/admins/me`, while admin login keeps admin-first behavior.
- Stopped login from silently navigating when no active profile is linked.
- Added `workshops` as the student recordings bundle source key.
- Normalized student project `action_items`, `resources`, and `deliverables` into stable UI arrays.
- Null protected recording and schedule URLs in the adapter when a row is marked `locked`.

Verification completed:

- Authenticated Supabase probe for the test account can now read one own `students` row.
- The same account can read own certificates, payment orders, and project submissions.
- Browser-smoked:
  - `/student`
  - `/student/announcements`
  - `/student/cohorts`
  - `/student/resources`
  - `/student/recordings`
  - `/student/schedule`
  - `/student/projects`
  - `/student/project-submissions`
  - `/student/certificates`
  - `/student/payments`
  - `/student/access`
  - `/student/support`
- `/student/projects` no longer crashes on null/string project deliverable data.
- `/student/recordings` now renders completed workshop recordings from the dashboard bundle.

Remaining follow-up:

- `/student/schedule` loaded successfully but the current test student has no visible schedule rows.
- `/student/announcements`, `/student/access`, and `/student/support` loaded empty for the current test data.
