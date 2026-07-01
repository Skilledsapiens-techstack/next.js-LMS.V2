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

## Phase 7: Admin Students And Cohorts Write Adapter

Status: completed locally and regression-tested with admin credentials on 2026-07-01.

Fixes applied:

- Added schema-aware write endpoint metadata for direct Supabase writes to:
  - `students`
  - `cohorts`
- Normalized admin student form payloads to real `students` columns:
  - `cohortIds[0]` -> `cohort_id`
  - `cohortNames[0]` -> `cohort_name`
  - `programNames` / `programKeys` -> `program_name`
  - `programKeys` -> `track_role_ids`
  - `waGroup` -> `wa_group_name`
  - dropped frontend-only `sendInvite`
- Normalized admin cohort form payloads to real `cohorts` columns:
  - `selfPacedResources` -> `sp_resources`
  - `selfPacedSessions` -> `sp_sessions`
- Reject unsupported write fields before sending a mutation to Supabase.
- Changed disabled write behavior from fake success to a real `403` error so the UI does not report saves that never reached Supabase.
- Confirmed live RLS already includes active-admin write policies for `students` and `cohorts`.

Verification completed:

- TypeScript passed after adapter changes.
- Live schema inspection confirmed target columns and existing active-admin write policies.
- Browser-tested admin login with `hr1.skilledsapiens@gmail.com`.
- Browser-created cohort `CODX-E2E-20260701113320-COHORT`.
- Browser-edited that cohort to `CODX-E2E-20260701113320-COHORT-UPDATED`, including self-paced session/resource fields.
- Browser-deactivated the cohort, then verified the persisted state in Supabase.
- Authenticated admin/RLS-tested cohort status writes back to `active`.
- Authenticated admin/RLS-created test student `STU-CODX-E2E-20260701113320`.
- Authenticated admin/RLS-updated the test student name, college, programs, role IDs, and WhatsApp group.
- Authenticated admin/RLS-tested student deactivate/reactivate writes.
- Verified persisted test rows in Supabase:
  - Cohort id `39afcdb8-aa61-4edb-b0e7-b801d5679281`
  - Student id `3f64e308-0be8-4edb-ae53-3ce86f3db81a`
  - Student email `codex.e2e+codx-e2e-20260701113320@example.com`

## Phase 8: Cohort Write Completion

Status: completed locally and applied to the linked project on 2026-07-01.

Migration:

- `supabase/migrations/20260701125801_admin_write_audit_logs.sql`

Fixes applied:

- Added an active-admin `audit_logs` insert policy for cohort write audit events.
- Added cohort audit rows for create, edit, and status-change writes.
- Added cohort write validation for required name, valid status, non-negative whole-number student counts, and valid date ordering.
- Added friendly duplicate handling for existing cohort name or cohort ID conflicts.
- Replaced the native browser confirm for status changes with an in-app confirmation dialog.
- Kept archive/delete behavior as status-based deactivation because the current `cohorts` table has no separate archive/delete column or workflow.

Verification completed:

- TypeScript passed.
- ESLint passed.
- Linked project policy `admin cohort writes can be audited by active admins` exists on `audit_logs`.
- Authenticated admin/RLS probe created test cohort `CODX-AUDIT-1782910844455`.
- Authenticated admin/RLS probe inserted audit actions:
  - `admin_cohort_created`
  - `admin_cohort_updated`
  - `admin_cohort_status_changed`

Operational note:

- The remote migration history was repaired on 2026-07-01 so local and remote July migrations are aligned. `supabase db push` now reports the remote database as up to date.

## Phase 9: Student Write Audit And Validation

Status: completed locally and applied to the linked project on 2026-07-01.

Migration:

- `supabase/migrations/20260701130924_admin_student_write_audit_logs.sql`

Fixes applied:

- Added an active-admin `audit_logs` insert policy for student write audit events.
- Added student audit rows for create, edit, and status-change writes.
- Added student write validation for required name/email, email formats, onboarding status values, and role ID list shape.
- Added friendly duplicate handling for existing student email conflicts.
- Added student form validation before save.
- Replaced immediate student deactivate/reactivate with an in-app confirmation dialog.

Verification completed:

- TypeScript passed.
- ESLint passed.
- Production build passed.
- Linked project policy `admin student writes can be audited by active admins` exists on `audit_logs`.
- Supabase migration history is aligned for:
  - `20260701095146`
  - `20260701102314`
  - `20260701125801`
  - `20260701130924`
  - `20260701161458`
- Authenticated admin/RLS probe created test student `STU-CODX-STUDENT-AUDIT-1782911532146`.
- Authenticated admin/RLS probe inserted audit actions:
  - `admin_student_created`
  - `admin_student_updated`
  - `admin_student_status_changed`

Remaining follow-up:

- Project-submission review writes still need dedicated endpoint/RLS coverage.

## Phase 10: Student Remaining Write Actions

Status: completed locally and applied to the linked project on 2026-07-01.

Migration:

- `supabase/migrations/20260701131729_admin_student_remaining_write_actions.sql`

Fixes applied:

- Added active-admin `email_queue` insert policy for student invite rows.
- Expanded the student audit policy for invite queue and LP attempt-limit update actions.
- Wired `POST /admins/students/import` to create-or-update student rows by email.
- Wired `GET /admins/students/:id/lp-attempts` to read `project_submission_student_limits`.
- Wired `PATCH /admins/students/:id/lp-attempts` to upsert `project_submission_student_limits`.
- Queued active `portal_invite` email template rows when admin student create/update requests `sendInvite`.
- Aligned the LP attempt input minimum with the live database constraint.

Verification completed:

- TypeScript passed.
- ESLint passed.
- Production build passed.
- Linked Supabase migration list shows the Phase 10 migration applied.
- Authenticated admin/RLS probe created and updated controlled test student `codex.student.remaining+1782912487753@example.com`.
- Authenticated admin/RLS probe queued a `portal_invite` row in `email_queue`.
- Authenticated admin/RLS probe upserted `project_submission_student_limits.max_attempts = 4`.
- Authenticated admin/RLS probe inserted audit actions:
  - `admin_student_created`
  - `admin_student_invite_queued`
  - `admin_student_lp_attempts_updated`

## Phase 11: Schedule Meeting Write Actions

Status: completed locally and applied to the linked project on 2026-07-01.

Migration:

- `supabase/migrations/20260701135149_admin_workshop_write_actions.sql`

Fixes applied:

- Added active-admin insert/update policies for `workshops`.
- Added active-admin audit policy for workshop create, update, status-change, and recording-link update actions.
- Wired `POST /admins/workshops` to create Schedule Meeting rows.
- Wired `PATCH /admins/workshops/:id` to edit Schedule Meeting rows.
- Wired `PATCH /admins/workshops/:id/complete` to mark a workshop completed.
- Wired `PATCH /admins/workshops/:id/recording` to save final YouTube/alternate recording URLs.
- Enabled the Schedule Meeting and Attach Recording UI buttons with validation and action feedback.
- Kept Zoom provider/API scheduling out of scope; this phase writes schedule rows only.

Verification completed:

- TypeScript passed.
- ESLint passed.
- Production build passed.
- Linked Supabase migration list shows the Phase 11 migration applied.
- Authenticated admin/RLS probe created, updated, completed, and attached recording URL to test workshop `CODX-WORKSHOP-1782914108656`.
- Authenticated admin/RLS probe inserted audit actions:
  - `admin_workshop_created`
  - `admin_workshop_updated`
  - `admin_workshop_status_changed`
  - `admin_workshop_recording_updated`

## Phase 12: Zoom-Backed Schedule Meeting

Status: completed locally and deployed to the linked project on 2026-07-01.

Edge Function:

- `supabase/functions/zoom-meetings/index.ts`

Fixes applied:

- Added source-controlled `zoom-meetings` Edge Function.
- Kept Zoom credentials server-side in Supabase secrets only; no Zoom secrets are exposed to the browser.
- Wired Schedule Meeting create/update/reschedule through the Edge Function.
- The Edge Function creates/updates real Zoom meetings under the selected default account owner.
- The Edge Function saves safe fields back to `workshops`: `zoom_id`, `join_url`, `zoom_account`, schedule fields, and status.
- Added Zoom recording fetch for `shared_screen_with_speaker_view` MP4 files.
- Multiple recording parts from the same meeting are saved as separate `workshop_recording_candidates` rows.
- Added manual publish flow that writes the selected candidate `play_url` to `workshops.zoom_recording_url`.
- Enforced student schedule visibility to `Scheduled` or `Live` rows with a `join_url`.

Zoom defaults:

- Timezone: `Asia/Kolkata`
- Waiting room: enabled
- Join before host: disabled
- Mute participants on entry: enabled
- Auto recording: off
- Passcode: not explicitly set by the app

Verification completed:

- `supabase functions deploy zoom-meetings` succeeded.
- TypeScript passed.
- ESLint passed.
- Production build passed.
- Live admin function probe created a real Zoom meeting for `Zoom Account 1` and saved `zoom_id` plus `join_url`.
- Live admin function probe updated the Account 1 Zoom meeting and marked the workshop completed.
- Live admin function probe created a real Zoom meeting for `Zoom Account 2` and saved `zoom_id` plus `join_url`.

## Phase 13: Schedule Meeting Cancel + Audit Policy

Status: implemented locally, migration applied, and Edge Function deployed to the linked project on 2026-07-01.

Migration:

- `supabase/migrations/20260701144757_admin_workshop_cancel_audit_policy.sql`

Fixes applied:

- Added `cancel-meeting` to `supabase/functions/zoom-meetings/index.ts`.
- Cancel flow calls Zoom delete first, then updates the workshop row to `Cancelled`, clears `join_url`, and keeps `zoom_id` for audit/reference.
- Added a clearer Edge Function error when the Zoom app is missing `meeting:delete` permission.
- Added `useCancelAdminWorkshop`.
- Added a compact Schedule Meeting confirmation modal and row-level Cancel CTA.
- Tightened the Postpone CTA to open the edit/reschedule flow immediately.
- Expanded the active-admin audit policy to cover all workshop action names emitted by the Edge Function:
  - `admin_workshop_created`
  - `admin_workshop_updated`
  - `admin_workshop_rescheduled`
  - `admin_workshop_cancelled`
  - `admin_workshop_status_changed`
  - `admin_workshop_recording_updated`
  - `admin_workshop_recordings_fetched`
  - `admin_workshop_recording_published`

Verification completed:

- Linked migration `20260701144757_admin_workshop_cancel_audit_policy` applied successfully.
- `supabase functions deploy zoom-meetings` succeeded.
- TypeScript passed.
- ESLint passed.
- Production build passed.
- Live admin create probe still creates a real Zoom meeting successfully.
- Live cancel probe reached Zoom but was blocked by missing Zoom OAuth scope `meeting:delete`; the LMS row was not archived, which is the intended safe failure behavior.
