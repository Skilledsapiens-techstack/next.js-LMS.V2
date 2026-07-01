# Supabase Route Integration Matrix

Status: Phase 2 baseline, created 2026-07-01.

The current app is a Vite React frontend that calls Supabase directly through `src/lib/supabaseApi.ts`. The route-like `apiGet`, `apiPost`, and `apiPatch` helpers keep existing feature hooks stable while reads move onto Supabase tables and RPCs.

## Integration State Summary

| Area | State | Notes |
| --- | --- | --- |
| Auth session validation | Wired | `createContext()` validates the Supabase access token and creates a token-scoped client for RLS-aware data calls. |
| Admin profile | Wired | `/admins/me` reads `admin_users`; Phase 1 migration captures required read grant and self-profile RLS policy. |
| Student profile | Wired, needs account QA | `/students/me` reads `students`; needs verification with a real student Auth account. |
| Admin read lists | Mostly wired | Table endpoints exist for the primary admin modules. Filters still need route-by-route smoke testing. |
| Student read lists | Mostly wired | Mix of student bundle RPCs, student view RPCs, and student-owned table reads. Needs real student QA. |
| Detail reads | Partially wired | Support ticket detail and enrollment request detail are wired. Other detail routes are not present. |
| Frontend writes | Intentionally gated | `VITE_WRITE_ACTIONS_ENABLED=false` keeps writes disabled locally. |
| Write route coverage | Partial | Only admin students and cohorts create/update paths are implemented in `supabaseApi.ts`; several hook mutations remain unsupported. |
| DB migrations | Started | First migration exists under `supabase/migrations`. Existing remote schema is not fully represented in repo migrations yet. |
| Security advisor follow-up | Pending | Existing warnings around public `SECURITY DEFINER` functions need a dedicated hardening phase. |

## Auth And Portal Routes

| UI route | Hook / caller | Supabase route | Source | State | Follow-up |
| --- | --- | --- | --- | --- | --- |
| `/login` | `LoginPage` | `/admins/me`, `/students/me` | `admin_users`, `students` | Wired | Confirm student-first/admin-first portal behavior once student QA account is available. |
| `/admin/*` | `ProtectedPortalRoute` | `/admins/me` | `admin_users` | Wired | Covered by Phase 1 admin policy migration. |
| `/student/*` | `ProtectedPortalRoute` | `/students/me` | `students` | Wired, unverified | Verify RLS and profile linking with a real student user. |

## Admin Read Routes

| UI route | Hook | Supabase route | Source | Query params used | State | Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| `/admin` | `useAdminDashboard` | `/admins/dashboard` | `lms_admin_dashboard_summary`, `workshops` | none | Wired | Advisor warns `lms_admin_dashboard_summary` is `SECURITY DEFINER`; confirm intended grants. |
| `/admin/announcements` | `useAdminAnnouncements` | `/admins/announcements` | `announcements` | `audience`, `priority`, `status`, `search`, pagination | Wired | Smoke-test filters against real columns. |
| `/admin/recording-candidates` | `useAdminRecordingCandidates` | `/admins/recording-candidates` | `workshop_recording_candidates` | `status`, `workshopId`, `zoomAccount`, `search`, pagination | Wired | Phase 1 migration captures required read access. |
| `/admin/workshops` | `useAdminWorkshops` | `/admins/workshops` | `workshops` | `accessType`, `status`, `search`, pagination | Wired | `status` maps to `workshop_status`; smoke-test `accessType`. |
| `/admin/resources` | `useAdminResources` | `/admins/resources` | `resources` | `accessType`, `status`, `search`, pagination | Wired | Search no longer references nonexistent `program_key`; array-backed program filtering still needs a dedicated design. |
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
| `/student` | `useStudentDashboard` | `/students/me/dashboard` | `students`, `student_dashboard_bundle`, `student_resources_view`, `student_projects_bundle`, `student_certificates_bundle` | none | Wired, unverified | Real student QA required; advisor warns student RPCs are `SECURITY DEFINER`. |
| `/student/announcements` | `useStudentAnnouncements` | `/students/me/announcements` | `student_dashboard_bundle` section | `priority`, `search`, pagination | Wired, needs browser QA | RPC/bundle client filtering now honors `priority`. |
| `/student/cohorts` | `useStudentCohorts` | `/students/me/cohorts` | `student_dashboard_bundle` section | `status`, `search`, pagination | Wired, needs browser QA | RPC/bundle client filtering now honors `status`. |
| `/student/recordings` | `useStudentRecordings` | `/students/me/recordings` | `student_dashboard_bundle` section | `accessType`, `source`, `search`, pagination | Wired, needs browser QA | RPC/bundle client filtering now honors `accessType` and `source`. |
| `/student/schedule` | `useStudentSchedule` | `/students/me/schedule` | `student_schedule_view` RPC | `accessType`, `status`, `search`, pagination | Wired, needs browser QA | RPC client filtering now honors `accessType` and `status`. |
| `/student/resources` | `useStudentResources` | `/students/me/resources` | `student_resources_view` RPC | `accessType`, `resourceType`, `search`, pagination | Wired, needs browser QA | RPC client filtering now honors `accessType` and `resourceType`; locked resource URLs are nulled by the RPC. |
| `/student/projects` | `useStudentProjects` | `/students/me/projects` | `student_projects_bundle` RPC | `programKey`, `roleId`, `search`, pagination | Wired, needs browser QA | RPC client filtering now honors `programKey` and `roleId`. |
| `/student/project-submissions` | `useStudentProjectSubmissions` | `/students/me/project-submissions` | `project_submission_requests` | `status`, `programKey`, `cohortName`, `search`, pagination | Wired, unverified | Uses `student_email = auth email`; verify RLS and column names. |
| `/student/certificates` | `useStudentCertificates` | `/students/me/certificates` | `certificates` | `certificateType`, `generationStatus`, `status`, `search`, pagination | Wired, unverified | Uses `student_email = auth email`; verify student-only RLS. |
| `/student/payments` | `useStudentPaymentOrders` | `/students/me/payment-orders` | `payment_orders` | `itemType`, `status`, `search`, pagination | Wired, unverified | Uses `student_email = auth email`; verify student-only RLS. |
| `/student/access` | `useStudentPaidAccess` | `/students/me/paid-access` | `paid_access` | `itemType`, `status`, `search`, pagination | Wired, unverified | Uses `student_email = auth email`; `activeNow` derived client-side. |
| `/student/support` | `useStudentSupportTickets` | `/students/me/support-tickets` | `support_tickets` | `status`, `search`, pagination | Wired, unverified | Uses `student_email = auth email`; verify `canReply` shape. |
| `/student/support/:ticketId` | `useStudentSupportTicketDetail` | `/students/me/support-tickets/:ticketId` | `support_tickets`, `support_ticket_messages` | none | Partially wired | Student detail filters messages to `visibility = public`. |
| `/student/community` | `ModulePlaceholderPage` | none | none | none | Placeholder | Community route exists in nav but has no page integration. |

## Mutation Coverage

| Hook | Supabase route | Current state | Notes |
| --- | --- | --- | --- |
| `useSaveAdminStudent` | `POST /admins/students` | Implemented but gated | Inserts into `students`; requires write flag and write RLS/backend decision. |
| `useUpdateAdminStudent` | `PATCH /admins/students/:id` | Implemented but gated | Updates `students` by `id`. |
| `useUpdateAdminStudentStatus` | `PATCH /admins/students/:id/status` | Implemented but gated | Updates `students` by `id`. |
| `useCreateAdminCohort` | `POST /admins/cohorts` | Implemented but gated | Inserts into `cohorts`. |
| `useUpdateAdminCohort` | `PATCH /admins/cohorts/:id` | Implemented but gated | Updates `cohorts` by `id`. |
| `useUpdateAdminCohortStatus` | `PATCH /admins/cohorts/:id/status` | Implemented but gated | Updates `cohorts` by `id`. |
| `useImportAdminStudents` | `POST /admins/students/import` | Unsupported | Hook exists, but `supabaseApi.ts` does not implement this route. |
| `useAdminStudentAttemptLimit` | `GET /admins/students/:id/lp-attempts` | Unsupported | Hook exists, but `supabaseApi.ts` does not implement this route. |
| `useUpdateAdminStudentAttemptLimit` | `PATCH /admins/students/:id/lp-attempts` | Unsupported | Hook exists, but `supabaseApi.ts` does not implement this route. |
| `useReviewAdminProjectSubmission` | `PATCH /admins/project-submissions/:id/approve|reject` | Unsupported | Hook exists, but `supabaseApi.ts` does not implement this route. |
| `useMarkAdminWorkshopCompleted` | `PATCH /admins/workshops/:id/complete` | Unsupported | Hook exists, but `supabaseApi.ts` does not implement this route. |

## Immediate Findings

1. Admin read routes have been smoke-tested in the browser with the active admin session.
2. Student routes should be treated as unverified until a real student Auth account is tested.
3. The direct browser-to-Supabase approach depends on exact grants/RLS for every table and RPC listed here.
4. Some hook mutations are already visible in code but will fail as unsupported once write gates are enabled.
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

1. Browser-smoke the student portal with a real student Auth session.
2. Modernize `lms_request_email()` away from deprecated `auth.role()` usage.
3. Continue security-definer RPC hardening as part of the broader RLS/security phase.
