# Supabase Route Integration Matrix

Status: Phase 2 baseline, created 2026-07-01.

The current app is a Vite React frontend that calls Supabase directly through `src/lib/supabaseApi.ts`. The route-like `apiGet`, `apiPost`, and `apiPatch` helpers keep existing feature hooks stable while reads move onto Supabase tables and RPCs.

## Integration State Summary

| Area | State | Notes |
| --- | --- | --- |
| Auth session validation | Wired | `createContext()` validates the Supabase access token and creates a token-scoped client for RLS-aware data calls. |
| Admin profile | Wired | `/admins/me` reads `admin_users`; Phase 1 migration captures required read grant and self-profile RLS policy. |
| Student profile | Wired and browser-smoked | `/students/me` reads `students`; Phase 6 adds own-profile RLS for authenticated students. |
| Admin read lists | Mostly wired | Table endpoints exist for the primary admin modules. Filters still need route-by-route smoke testing. |
| Student read lists | Wired and browser-smoked | Mix of student bundle RPCs, student view RPCs, and student-owned table reads; Phase 6 smoke-tested with a real student Auth account. |
| Detail reads | Partially wired | Support ticket detail and enrollment request detail are wired. Other detail routes are not present. |
| Frontend writes | Intentionally gated | `VITE_WRITE_ACTIONS_ENABLED=false` keeps writes disabled locally. |
| Write route coverage | Partial and regression-tested | Admin students/cohorts create/update/status paths plus student import, invite queue, and LP attempts are implemented and tested; non-student write hooks remain unsupported. |
| DB migrations | Started | First migration exists under `supabase/migrations`. Existing remote schema is not fully represented in repo migrations yet. |
| Security advisor follow-up | Pending | Existing warnings around public `SECURITY DEFINER` functions need a dedicated hardening phase. |

## Auth And Portal Routes

| UI route | Hook / caller | Supabase route | Source | State | Follow-up |
| --- | --- | --- | --- | --- | --- |
| `/login` | `LoginPage` | `/admins/me`, `/students/me` | `admin_users`, `students` | Wired and browser-smoked | Student login checks student-first; admin login checks admin-first. Missing profiles no longer silently navigate. |
| `/admin/*` | `ProtectedPortalRoute` | `/admins/me` | `admin_users` | Wired | Covered by Phase 1 admin policy migration. |
| `/student/*` | `ProtectedPortalRoute` | `/students/me` | `students` | Wired and browser-smoked | Phase 6 added own-student read policy and verified profile linking with a real student user. |

## Admin Read Routes

| UI route | Hook | Supabase route | Source | Query params used | State | Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| `/admin` | `useAdminDashboard` | `/admins/dashboard` | `lms_admin_dashboard_summary`, `workshops` | none | Wired | Advisor warns `lms_admin_dashboard_summary` is `SECURITY DEFINER`; confirm intended grants. |
| `/admin/announcements` | `useAdminAnnouncements` | `/admins/announcements` | `announcements` | `audience`, `priority`, `status`, `search`, pagination | Wired | Smoke-test filters against real columns. |
| `/admin/recording-candidates` | `useAdminRecordingCandidates` | `/admins/recording-candidates` | `workshop_recording_candidates` | `status`, `workshopId`, `zoomAccount`, `search`, pagination | Wired | Phase 1 migration captures required read access. |
| `/admin/workshops` | `useAdminWorkshops` | `/admins/workshops` | `workshops` | `accessType`, `status`, `search`, pagination | Wired | `status` maps to `workshop_status`; smoke-test `accessType`. |
| `/admin/resources` | `useAdminResources` | `/admins/resources` | `resources` | `accessType`, `status`, `search`, pagination | Wired + write-enabled | URL-based resources support create, update, archive/restore, cohort tagging, and manual program tagging. |
| `/admin/students` | `useAdminStudents` | `/admins/students` | `students` | `status`, `cohortName`, `search`, pagination | Wired | `status` maps to boolean `active`; Active/Inactive filter smoke-tested. |
| `/admin/cohorts` | `useAdminCohorts` | `/admins/cohorts` | `cohorts` | `program`, `status`, `sort`, `search`, pagination | Wired | `program` maps to `program_key`; sort aliases are implemented. |
| `/admin/programs` | `useAdminPrograms` | `/admins/programs` | `programs` | `status`, `search`, pagination | Wired | Smoke-test `status`. |
| `/admin/projects` | `useAdminProjects` | `/admins/projects` | `projects` | `programKey`, `roleId`, `status`, `search`, pagination | Wired | Smoke-test `roleId` if source table uses a different column name. |
| Project roles selector | `useAdminProjectRoles` | `/admins/project-roles` | `role_master` | `programKey`, `status`, `search`, pagination | Wired | `role_name`/`role_category` are normalized to `name`/`category` for UI consumers. |
| `/admin/project-submissions` | `useAdminProjectSubmissions` | `/admins/project-submissions` | `project_submission_requests` | `status`, `programKey`, `roleId`, `cohortName`, `submittedDate`, `search`, pagination | Read wired | `pending` maps to `submitted`; `duplicates` remains a pending product/data-design item because the current table has no duplicate-group columns. |
| `/admin/certificates` | `useAdminCertificates` | `/admins/certificates` | `certificates` | `certificateType`, `generationStatus`, `status`, `search`, pagination | Wired | Smoke-test filters. |
| `/admin/certificate-requests` | `useAdminCertificateRequests` | `/admins/certificate-requests` | `certificate_requests` | `adminStatus`, `moderatorStatus`, `search`, pagination | Wired | Smoke-test filters. |
| `/admin/enrollments` | `useAdminEnrollmentRequests` | `/admins/enrollment-requests` | `enrollment_requests` | `paymentStatus`, `requestType`, `careerLevel`, `personalMentor`, `search`, pagination | Wired | Confirm column names for `paymentStatus`, `requestType`, `personalMentor`. |
| `/admin/enrollments/:id` | `useAdminEnrollmentRequestDetail` | `/admins/enrollment-requests/:id` | `enrollment_requests`, `enrollment_request_items`, `enrollment_status_history` | none | Partially wired | Confirm item/history RLS and whether `request_id` joins should use external ID or internal UUID consistently. |
| `/admin/enrollment-exceptions` | `useAdminEnrollmentExceptions` | `/admins/enrollment-exceptions` | `enrollment_exceptions` | `exceptionType`, `status`, `search`, pagination | Wired | Smoke-test filters. |
| `/admin/enrollment-webhook-events` | `useAdminEnrollmentWebhookEvents` | `/admins/enrollment-webhook-events` | `enrollment_webhook_events` | `status`, `search`, pagination | Wired | Smoke-test filters. |
| `/admin/payment-orders` | `useAdminPaymentOrders` | `/admins/payment-orders` | `payment_orders` | `itemType`, `status`, `search`, pagination | Wired | Smoke-test filters. |
| `/admin/paid-access` | `useAdminPaidAccess` | `/admins/paid-access` | `paid_access` | `itemType`, `status`, `search`, pagination | Wired | `activeNow` is derived client-side. |
| `/admin/support` | `useAdminSupportTickets` | `/admins/support-tickets` | `support_tickets` | `category`, `priority`, `status`, `search`, pagination | Wired | `category` maps to `category_name`. |
| `/admin/support/:ticketId` | `useAdminSupportTicketDetail` | `/admins/support-tickets/:ticketId` | `support_tickets`, `support_ticket_messages` | none | Partially wired | Confirm message RLS and `ticket_id` lookup behavior. |

## Student Read Routes

| UI route | Hook | Supabase route | Source | Query params used | State | Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| `/student` | `useStudentDashboard` | `/students/me/dashboard` | `students`, `student_dashboard_bundle`, `student_resources_view`, `student_projects_bundle`, `student_certificates_bundle` | none | Wired and browser-smoked | Advisor warns student RPCs are `SECURITY DEFINER`; broader hardening remains pending. |
| `/student/announcements` | `useStudentAnnouncements` | `/students/me/announcements` | `student_dashboard_bundle` section | `priority`, `search`, pagination | Wired and browser-smoked | Loaded empty for current test data; RPC/bundle client filtering honors `priority`. |
| `/student/cohorts` | `useStudentCohorts` | `/students/me/cohorts` | `student_dashboard_bundle` section | `status`, `search`, pagination | Wired and browser-smoked | RPC/bundle client filtering honors `status`. |
| `/student/recordings` | `useStudentRecordings` | `/students/me/recordings` | `student_dashboard_bundle` section | `accessType`, `source`, `search`, pagination | Wired and browser-smoked | Uses `workshops` bundle section; adapter derives source and hides locked recording URLs. |
| `/student/schedule` | `useStudentSchedule` | `/students/me/schedule` | `student_schedule_view` RPC | `accessType`, `status`, `search`, pagination | Wired and browser-smoked | Loaded empty for current test data; adapter hides locked join URLs. |
| `/student/resources` | `useStudentResources` | `/students/me/resources` | `student_resources_view` RPC | `accessType`, `resourceType`, `search`, pagination | Wired and browser-smoked | RPC client filtering honors `accessType` and `resourceType`; locked resource URLs are nulled by the RPC. |
| `/student/projects` | `useStudentProjects` | `/students/me/projects` | `student_projects_bundle` RPC | `programKey`, `roleId`, `search`, pagination | Wired and browser-smoked | Adapter normalizes null/string project task, document, and deliverable fields into arrays. |
| `/student/project-submissions` | `useStudentProjectSubmissions` | `/students/me/project-submissions` | `project_submission_requests` | `status`, `programKey`, `cohortName`, `search`, pagination | Wired and browser-smoked | Phase 6 adds student-owned read policy. |
| `/student/certificates` | `useStudentCertificates` | `/students/me/certificates` | `certificates` | `certificateType`, `generationStatus`, `status`, `search`, pagination | Wired and browser-smoked | Phase 6 adds student-owned read policy. |
| `/student/payments` | `useStudentPaymentOrders` | `/students/me/payment-orders` | `payment_orders` | `itemType`, `status`, `search`, pagination | Wired and browser-smoked | Phase 6 adds student-owned read policy. |
| `/student/access` | `useStudentPaidAccess` | `/students/me/paid-access` | `paid_access` | `itemType`, `status`, `search`, pagination | Wired and browser-smoked | Loaded empty for current test data; Phase 6 adds student-owned read policy. |
| `/student/support` | `useStudentSupportTickets` | `/students/me/support-tickets` | `support_tickets` | `status`, `search`, pagination | Wired and browser-smoked | Loaded empty for current test data; existing student support RLS is in place. |
| `/student/support/:ticketId` | `useStudentSupportTicketDetail` | `/students/me/support-tickets/:ticketId` | `support_tickets`, `support_ticket_messages` | none | Partially wired | Student detail filters messages to `visibility = public`. |
| `/student/community` | `ModulePlaceholderPage` | none | none | none | Placeholder | Community route exists in nav but has no page integration. |

## Mutation Coverage

| Hook | Supabase route | Current state | Notes |
| --- | --- | --- | --- |
| `useSaveAdminStudent` | `POST /admins/students` | Tested and audited | Authenticated admin/RLS-created test student `STU-CODX-E2E-20260701113320`; student audit probe verified `admin_student_created`. |
| `useUpdateAdminStudent` | `PATCH /admins/students/:id` | Tested and audited | Authenticated admin/RLS-updated the test student fields; student audit probe verified `admin_student_updated`. |
| `useUpdateAdminStudentStatus` | `PATCH /admins/students/:id/status` | Tested and audited | Status writes use an in-app confirmation dialog and verified `admin_student_status_changed` audit insert. |
| `useCreateAdminCohort` | `POST /admins/cohorts` | Browser-tested and audited | Browser-created cohort `CODX-E2E-20260701113320-COHORT`; authenticated admin/RLS probe verified `admin_cohort_created` audit insert. |
| `useUpdateAdminCohort` | `PATCH /admins/cohorts/:id` | Browser-tested and audited | Browser-updated cohort name plus self-paced session/resource fields; authenticated admin/RLS probe verified `admin_cohort_updated` audit insert. |
| `useUpdateAdminCohortStatus` | `PATCH /admins/cohorts/:id/status` | Tested and audited | Status writes use an in-app confirmation dialog and verified `admin_cohort_status_changed` audit insert. |
| `useImportAdminStudents` | `POST /admins/students/import` | Wired and RLS-tested | Creates or updates students by email, validates rows, and audits create/update actions. |
| `useAdminStudentAttemptLimit` | `GET /admins/students/:id/lp-attempts` | Wired and RLS-tested | Reads `project_submission_student_limits`; missing rows return the UI default of 3 attempts. |
| `useUpdateAdminStudentAttemptLimit` | `PATCH /admins/students/:id/lp-attempts` | Wired and RLS-tested | Upserts `project_submission_student_limits` and audits `admin_student_lp_attempts_updated`. |
| `useSaveAdminWorkshop` | `zoom-meetings:create-meeting` | Zoom-backed and deployed | Creates a real Zoom meeting through the Edge Function and saves safe workshop fields. |
| `useUpdateAdminWorkshop` | `zoom-meetings:update-meeting` | Zoom-backed and deployed | Updates the real Zoom meeting plus the Supabase workshop row. |
| `useRescheduleAdminWorkshop` | `zoom-meetings:reschedule-meeting` | Zoom-backed and deployed | Updates date/time/duration in Zoom and Supabase. |
| `useCancelAdminWorkshop` | `zoom-meetings:cancel-meeting` | Implemented; blocked by Zoom app scope | Cancels Zoom first, then archives the workshop and clears `join_url`. The current Zoom app still needs `meeting:delete` scope. |
| `useFetchAdminWorkshopRecordings` | `zoom-meetings:fetch-recordings` | Zoom-backed and deployed | Fetches `shared_screen_with_speaker_view` MP4 files into recording candidates. |
| `usePublishAdminWorkshopRecording` | `zoom-meetings:publish-recording` | Zoom-backed and deployed | Publishes the selected candidate `play_url` to the workshop recording URL. |
| `useUpdateAdminWorkshopRecording` | `PATCH /admins/workshops/:id/recording` | Wired and RLS-tested | Saves manual final recording URLs as a fallback and audits `admin_workshop_recording_updated`. |
| `useMarkAdminWorkshopCompleted` | `zoom-meetings:complete-meeting` | Deployed | Marks workshops completed through the Edge Function. |
| `useSaveAdminResource` | `POST /admins/resources` | Browser-tested and audited | Creates URL/Google Drive resources; supports free/paid, cohorts, and manual program tags. |
| `useUpdateAdminResource` | `PATCH /admins/resources/:id` | Browser-tested and audited | Updates resource metadata, URL, pricing, audience tags, and status. |
| `useArchiveAdminResource` | `PATCH /admins/resources/:id/archive` | Browser-tested and audited | Sets `status = inactive` instead of deleting, hiding the resource from students. |
| `useRestoreAdminResource` | `PATCH /admins/resources/:id/restore` | Browser-tested and audited | Restores archived resources by setting `status = active`. |
| `useReviewAdminProjectSubmission` | `PATCH /admins/project-submissions/:id/approve|reject` | Unsupported | Hook exists, but `supabaseApi.ts` does not implement this route. |

## Immediate Findings

1. Admin read routes have been smoke-tested in the browser with the active admin session.
2. Student routes were browser-smoked with a real student Auth account in Phase 6.
3. The direct browser-to-Supabase approach depends on exact grants/RLS for every table and RPC listed here.
4. Some non-student hook mutations are already visible in code but will fail as unsupported once write gates are enabled.
5. Existing public `SECURITY DEFINER` RPC warnings should be resolved before expanding privileged access.

## Next Phase Recommendation

Phase 3 started by smoke-testing admin read routes in the browser and fixing endpoint mapping mismatches in `src/lib/supabaseApi.ts`.

Completed Phase 3 fixes:

- Ignored sentinel filter value `any`.
- Mapped admin student `status` filter to boolean `students.active`.
- Mapped support `category` filter to `support_tickets.category_name`.
- Removed nonexistent `resources.program_key` from resource search columns.
- Mapped project role source fields `role_name` and `role_category` into UI fields `name` and `category`.
- Mapped project-submission `pending` filter to source status `submitted`.
- Mapped project-submission date filtering to `submitted_at`.

Remaining Phase 3 follow-ups:

1. Decide the data model for project-submission `duplicates`, because the current table does not expose duplicate-group columns.
2. Decide how resource/program filtering should work for array-backed `resources.program_keys`.
3. Continue targeted filter QA for enrollments, certificates, payments, and support once representative data is available.

## Phase 4 Student Read Hardening

Completed Phase 4 fixes:

- RPC-backed student lists now apply non-search filters client-side after row normalization.
- Student announcements honor `priority`.
- Student cohorts honor `status`.
- Student recordings honor `accessType` and `source`.
- Student schedule honors `accessType` and `status`.
- Student resources honor `accessType` and `resourceType`.
- Student projects honor `programKey` and `roleId`, including array-backed `programKeys`.

Phase 4 Supabase audit notes:

- Student RPCs are granted to `authenticated`, `postgres`, and `service_role`.
- Student RPCs are `SECURITY DEFINER`, but they use `lms_request_email()` / `lms_student_id_for_request()`.
- For authenticated users, `p_student_email` is ignored and the JWT email is used.
- For `service_role`, `p_student_email` can be used for admin/server-side access.
- `student_resources_view` nulls locked resource URLs.

Remaining Phase 4 follow-ups:

1. Continue security-definer RPC hardening as part of the broader RLS/security phase.

## Phase 5 Student RPC Helper Hardening

Completed Phase 5 fixes:

- Added `supabase/migrations/20260701102314_harden_student_rpc_request_email.sql`.
- Replaced deprecated `auth.role()` usage in `public.lms_request_email()`.
- Preserved service-role-only `p_student_email` override behavior.
- Preserved browser/authenticated behavior where the caller JWT email is authoritative.

Verification:

- Linked project `public.lms_request_email()` no longer contains `auth.role()`.
- No ordinary `public` functions currently contain `auth.role()`.
- Broader Supabase advisor warnings remain for other public `SECURITY DEFINER` functions and mutable `search_path` functions.

## Phase 6 Student Browser QA And RLS Policies

Completed Phase 6 fixes:

- Added `supabase/migrations/20260701161458_student_owned_read_policies.sql`.
- Added student-owned select policies for `students`, `certificates`, `paid_access`, `payment_orders`, and `project_submission_requests`.
- Fixed login portal probing order and missing-profile handling.
- Added `workshops` as a supported student recordings bundle section.
- Normalized project tasks/documents/deliverables from null, strings, arrays, or nested objects.
- Hid locked recording and schedule URLs in the direct Supabase adapter.

Verification:

- Authenticated test student can read their own profile row.
- Browser-smoked the main student routes from `/student` through support, payments, certificates, projects, recordings, resources, cohorts, and schedule.
- `/student/projects` no longer crashes on null/string project metadata.
- `/student/recordings` renders workshop recording rows from the dashboard bundle.

## Phase 7 Admin Students And Cohorts Write Adapter

Completed Phase 7 fixes:

- Added write endpoint metadata for `students` and `cohorts`.
- Normalized admin student create/update payloads to current table columns.
- Normalized admin cohort create/update payloads to current table columns.
- Rejected unsupported write fields before a Supabase mutation is attempted.
- Changed disabled write behavior to throw `403` instead of returning a fake success object.
- Added cohort write validation and duplicate-friendly conflict errors.
- Added cohort write audit logging for create, edit, and status changes.
- Replaced native cohort status confirmation with an in-app dialog.
- Added student write validation and duplicate-friendly email conflict errors.
- Added student write audit logging for create, edit, and status changes.
- Replaced immediate student status changes with an in-app confirmation dialog.

Verification:

- TypeScript passed.
- Live schema/policy inspection confirmed `students` and `cohorts` columns plus existing active-admin write policies.
- Browser-tested admin cohort create, edit, and deactivate with `VITE_WRITE_ACTIONS_ENABLED=true`.
- Authenticated admin/RLS-tested cohort status restore and student create, edit, deactivate, and reactivate.
- Authenticated admin/RLS-tested cohort audit rows for create, update, and status-change actions.
- Authenticated admin/RLS-tested student audit rows for create, update, and status-change actions.

Pending:

- Project-submission review writes remain unsupported.

## Phase 10 Admin Student Remaining Write Actions

Completed Phase 10 fixes:

- Added active-admin insert policy for student invite rows in `email_queue`.
- Expanded student audit policy for invite queue and LP attempt-limit updates.
- Wired CSV import to create-or-update student rows by email.
- Wired LP attempt read/update routes to `project_submission_student_limits`.
- Queued `portal_invite` email rows when admin student create/update requests `sendInvite`.
- Aligned LP attempt UI validation with the database `max_attempts >= 1` constraint.

Verification:

- TypeScript passed.
- ESLint passed.
- Production build passed.
- Linked migration `20260701131729_admin_student_remaining_write_actions` is applied.
- Authenticated admin/RLS-tested controlled student create/update, invite queue insert, LP attempt upsert, and related audit actions.

## Phase 11 Schedule Meeting Write Actions

Completed Phase 11 fixes:

- Added active-admin insert/update policies for `workshops`.
- Added audit policy for workshop create, update, status-change, and recording-link update actions.
- Wired Schedule Meeting create/edit, mark completed, and final recording-link save routes.
- Enabled the Schedule Meeting and Attach Recording UI buttons with validation and action feedback.
- Kept Zoom provider/API scheduling out of scope; this phase writes schedule rows only.

Verification:

- TypeScript passed.
- ESLint passed.
- Production build passed.
- Linked migration `20260701135149_admin_workshop_write_actions` is applied.
- Authenticated admin/RLS-tested workshop create, update, complete, recording URL update, and related audit actions.

## Phase 12 Zoom-Backed Schedule Meeting

Completed Phase 12 fixes:

- Added source-controlled `supabase/functions/zoom-meetings/index.ts`.
- Deployed `zoom-meetings` to the linked Supabase project.
- Kept Zoom secrets server-side in Supabase Edge Function secrets only.
- Wired create/update/reschedule/complete/fetch-recordings/publish-recording actions through the Edge Function.
- Recording fetch saves multiple matching `shared_screen_with_speaker_view` MP4 files as separate candidates for admin review.
- Student schedule visibility is additionally guarded to `Scheduled` or `Live` rows with a join URL.

Verification:

- TypeScript passed.
- ESLint passed.
- Production build passed.
- Live admin function probe created and updated a real Zoom meeting on Account 1.
- Live admin function probe created a real Zoom meeting on Account 2.

## Phase 13 Schedule Meeting Cancel + Audit Policy

Completed Phase 13 fixes:

- Added `cancel-meeting` to the `zoom-meetings` Edge Function.
- Cancel flow deletes the Zoom meeting first, then updates the workshop row to `Cancelled`, clears `join_url`, and keeps `zoom_id` for audit/reference.
- Added `useCancelAdminWorkshop` and a compact in-app confirmation dialog on Schedule Meeting rows.
- Expanded the workshop audit insert policy for all Edge Function action names:
  - `admin_workshop_created`
  - `admin_workshop_updated`
  - `admin_workshop_rescheduled`
  - `admin_workshop_cancelled`
  - `admin_workshop_status_changed`
  - `admin_workshop_recording_updated`
  - `admin_workshop_recordings_fetched`
  - `admin_workshop_recording_published`

Verification:

- Linked migration `20260701144757_admin_workshop_cancel_audit_policy` is applied.
- `supabase functions deploy zoom-meetings` succeeded.
- TypeScript passed.
- ESLint passed.
- Production build passed.
- Live admin create probe still succeeds.
- Live cancel probe is blocked by the current Zoom OAuth app scope. Zoom returned missing `meeting:delete` scope, so the function correctly did not mark the LMS workshop cancelled.
