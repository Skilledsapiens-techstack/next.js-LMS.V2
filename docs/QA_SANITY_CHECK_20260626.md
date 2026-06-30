# QA Sanity Check

Date: 2026-06-27

## Scope

Reviewed the Nest.js LMS foundation and read-only portal slices:

- Student auth/profile/dashboard APIs.
- Student announcements API.
- Student certificate list API.
- Student cohorts API.
- Student paid access list API.
- Student payment order list API.
- Student project catalog API.
- Student project submission history API.
- Student recordings API.
- Student resource library API.
- Student upcoming schedule API.
- Student support ticket list API.
- Student support ticket detail/thread API.
- Admin auth/profile/dashboard APIs.
- Admin announcement list API.
- Admin bounded list APIs.
- Admin certificate registry list API.
- Admin certificate request queue API.
- Admin enrollment request queue API.
- Admin enrollment request detail API.
- Admin enrollment exception queue API.
- Admin enrollment webhook event queue API.
- Admin paid access list API.
- Admin payment order list API.
- Admin project catalog list API.
- Admin project role catalog list API.
- Admin project submission review queue API.
- Admin recording candidate list API.
- Admin support ticket queue API.
- Admin support ticket detail/thread API.
- Admin workshop/meeting list API.
- Razorpay webhook verification and normalization foundation.
- Razorpay webhook persistence adapter gated off by default.
- Razorpay payment order transition planning without active payment order writes.
- Razorpay payment order transition writer gated off by default.
- Razorpay webhook event status recording for processed, exception, skipped, duplicate, and failed outcomes.
- Local enrollment activation planning with idempotency keys and no active writes.
- Enrollment activation executor gated off by default and not wired to a live endpoint.
- Enrollment activation source loader for payment order, request, and request item reads.
- Internal enrollment activation workflow that composes loader and executor without a live trigger.
- Razorpay enrollment activation trigger decision returned in webhook responses without live activation execution.
- Phase 4 Supabase write-readiness checklist.
- Local project submission planning with visibility, HTTPS link, attempt-limit, and idempotency checks.
- Project submission source loader for active student, active project, and existing submission reads.
- Project submission executor gated off by default and not wired to a live endpoint.
- Local admin project submission review planning with safe review-state transition checks.
- Admin project submission review source loader for one project submission read and local plan creation.
- Admin project submission review executor gated off by default and not wired to a live endpoint.
- Internal admin project submission review workflow that composes loader and executor without a live trigger.
- Local student support ticket creation planning with validation, idempotency, first-message, and audit intent.
- Support ticket creation source loader for active student read and local plan creation.
- Support ticket creation executor gated off by default and not wired to a live endpoint.
- Internal support ticket creation workflow that composes loader and executor without a live trigger.
- Local support ticket reply planning with student/admin visibility rules, status-update intent, and audit intent.
- Support ticket reply source loader for one support ticket read, student ownership enforcement, and local plan creation.
- Support ticket reply executor gated off by default and not wired to a live endpoint.
- Internal support ticket reply workflow that composes loader and executor without a live trigger.
- Local support ticket status transition planning with admin-only status-update and audit intent.
- Support ticket status transition source loader for one support ticket read and local plan creation.
- Support ticket status transition executor gated off by default and not wired to a live endpoint.
- Internal support ticket status transition workflow that composes loader and executor without a live trigger.
- Local certificate request approval planning with admin approve/reject validation, generation-job intent, and audit intent.
- Certificate request approval source loader for one certificate request read and local plan creation.
- Certificate request approval executor gated off by default and not wired to a live endpoint.
- Internal certificate request approval workflow that composes loader and executor without a live trigger.
- Local certificate generation finalization planning from completed private-storage PDF metadata.
- Certificate generation finalization source loader for one generation job read and local plan creation.
- Certificate generation finalization executor gated off by default and not wired to a live endpoint.
- Internal certificate generation finalization workflow that composes loader and executor without a live trigger.
- Certificate PDF batch loader for bounded read-only selection of pending and stale-generating generation job keys for a future worker.
- Internal certificate PDF batch workflow that sequentially composes the batch loader and PDF generation workflow without a scheduler trigger.
- Local certificate PDF render planning for future render document model and private storage target creation.
- Certificate PDF render source loader for one generation job read and local plan creation.
- Certificate PDF render-start executor gated off by default and not wired to a live endpoint/job runner.
- Certificate PDF renderer service for deterministic local PDF bytes and SHA-256 metadata with no storage or Supabase writes.
- Certificate PDF storage writer gated off by default and not wired to a live endpoint/job runner.
- Internal certificate PDF generation workflow that composes render-start, local rendering, storage upload, and finalization without a live trigger.
- Local workshop status transition planning with conservative state movement and audit intent.
- Workshop status transition source loader for one workshop read and local plan creation.
- Workshop status transition executor gated off by default and not wired to a live endpoint.
- Internal workshop status transition workflow that composes loader and executor without a live trigger.
- Provider-neutral workshop meeting boundary gated off by default with no Zoom/provider adapter or network call configured.
- Local workshop meeting scheduling planner for provider payload, future workshop update intent, and audit intent without provider calls or Supabase writes.
- Workshop meeting schedule executor gated off by default and not wired to a live endpoint or worker.
- Internal workshop meeting schedule workflow that composes planner, provider boundary, and executor without a live trigger.
- Local recording candidate review planning with draft-only review/reject transitions and audit intent.
- Recording candidate review source loader for one candidate read and local plan creation.
- Recording candidate review executor gated off by default and not wired to a live endpoint.
- Internal recording candidate review workflow that composes loader and executor without a live trigger.
- Local recording publication planning for reviewed candidate publication onto completed workshops.
- Recording publication source loader for workshop/candidate reads and local plan creation.
- Recording publication executor gated off by default and not wired to a live endpoint.
- Internal recording publication workflow that composes loader and executor without a live trigger.
- Local email outbox planning with server-side template rendering, deterministic idempotency, business entity association, and audit intent.
- Email outbox source loader for one active template read and local plan creation.
- Email outbox executor gated off by default and not wired to a live endpoint or worker.
- Internal email outbox workflow that composes loader and executor without a live trigger.
- Local email dispatch planning for provider-neutral pending-job dispatch decisions and sending-lock intent.
- Email dispatch batch loader for bounded read-only selection of due pending outbox job keys for a future worker.
- Internal email dispatch batch workflow that sequentially composes the batch loader and email send workflow without a scheduler trigger.
- Email dispatch source loader for one outbox-job read and local dispatch plan creation.
- Email dispatch executor gated off by default and not wired to a live worker or provider.
- Internal email dispatch workflow that composes loader and executor without a live trigger.
- Provider-neutral email sender boundary gated off by default with no provider adapter or network call configured.
- Internal email send workflow that composes dispatch locking, provider sending, and delivery-result recording without a live trigger.
- Local email delivery result planning for provider-success, provider-failure, retry-pending, terminal-failed, and error-log intent.
- Email delivery result source loader for one outbox-job read and local result plan creation.
- Email delivery result executor gated off by default and not wired to a live worker or provider.
- Internal email delivery result workflow that composes loader and executor without a live trigger.
- Local operational cleanup planning for stale email locks, abandoned certificate render jobs, processed webhook retention, and old error-log retention without live mutation.
- Operational cleanup source loader for bounded candidate reads across operational tables.
- Operational cleanup executor gated off by default and not wired to a live worker.
- Internal operational cleanup workflow that composes loader and executor without a live trigger.
- Supabase service boundary.
- Auth guards and request context decorators.
- No-Google/no-Apps-Script runtime guardrails.
- Phase 4 local foundation checkpoint documenting disabled gates, internal boundaries, and Supabase permission boundary.
- Phase 4 local gate audit script added for checking disabled defaults before any Supabase approval request.
- Phase 4 Supabase read-only discovery checkpoint added without running migrations, writes, storage changes, secret changes, or gate activation.
- Phase 4 Supabase read-only schema audit added; gaps are documented without changing Supabase.
- Consolidated development cycle guide added to keep future phase work sequential, auditable, and safe for the live HTML app.
- Phase 5 UI migration map added for read-only student/admin route migration before frontend scaffolding.
- Phase 5 frontend scaffold added under `apps/web` with read-only student/admin shells and root web scripts.
- Phase 5 initial visual foundation added for a polished operational LMS portal shell before module screen implementation.
- Phase 5 Community navigation added for student/admin portals as read-only module placeholders.
- Phase 5 API/auth foundation added with Supabase Auth session provider, auth callback, email-link login shell, bearer-token API probes, and student/admin protected route guards.
- Phase 5 shared component baseline added with reusable page headers, filter shell, data panel, loading/empty/error/locked states, and disabled write-action control.
- Phase 5 Student Dashboard read-only screen added with typed frontend hooks for `students/me` and `students/me/dashboard`, profile context, summary counts, module overview, and guarded UI states.
- Phase 5 Student Announcements read-only screen added with typed frontend hook for `students/me/announcements`, URL-backed search, priority filters, pagination, pinned/priority badges, and guarded UI states.
- Phase 5 Student Cohorts read-only screen added with typed frontend hook for `students/me/cohorts`, URL-backed search, status filters, pagination, safe group-link display, and guarded UI states.
- Phase 5 Student Resources read-only screen added with typed frontend hook for `students/me/resources`, URL-backed search, access/type filters, pagination, safe unlocked links, and locked-content states.
- Phase 5 Student Recordings read-only screen added with typed frontend hook for `students/me/recordings`, URL-backed search, access/source filters, pagination, safe unlocked playback links, and locked-content states.
- Phase 5 Student Schedule read-only screen added with typed frontend hook for `students/me/schedule`, URL-backed search, access/status filters, pagination, safe unlocked join links, and locked-content states.
- Phase 5 Student Projects read-only screen added with typed frontend hook for `students/me/projects`, URL-backed search, program/role filters, pagination, parsed tasks/documents/deliverables, and read-only submission guidance.
- Phase 5 Student Project Submissions read-only screen added with typed frontend hook for `students/me/project-submissions`, URL-backed search, status/program/cohort filters, pagination, attempt/repeat indicators, safe submission references, and read-only workflow guidance.
- Phase 5 Student Certificates read-only screen added with typed frontend hook for `students/me/certificates`, URL-backed search, status/generation/type filters, pagination, certificate metadata, and no private PDF storage or generation controls.
- Phase 5 Student Payments read-only screen added with typed frontend hook for `students/me/payment-orders`, URL-backed search, status/item-type filters, pagination, safe order references, and no payment initiation, verification, refund, or signature workflow exposure.
- Phase 5 Student Paid Access read-only screen added with typed frontend hook for `students/me/paid-access`, URL-backed search, status/item-type filters, pagination, active-now/expiry visibility, and no grant, revoke, expiry adjustment, or reconciliation workflow exposure.
- Phase 5 Student Support read-only list/detail screens added with typed frontend hooks for `students/me/support-tickets` and `students/me/support-tickets/:ticketId`, owned-ticket visibility, public messages only, and no create/reply/attachment/internal-note workflow exposure.
- Phase 5 Student Community backend contract gap recorded; no guessed UI or table dependency was added.
- Phase 5 Admin Dashboard read-only screen added with typed frontend hooks for `admins/me` and `admins/dashboard`, defensive operational summary counts, admin profile context, and disabled-write guidance.
- Phase 5 Admin Announcements read-only screen added with typed frontend hook for `admins/announcements`, URL-backed search, status/priority/audience filters, pagination, safe audience display, and no create/edit/publish/pin/delete controls.
- Phase 5 Admin Students read-only screen added with typed frontend hook for `admins/students`, URL-backed search, active/inactive filters, pagination, assignment/track-role visibility, and no profile edit, activation, enrollment, or access controls.
- Phase 5 Admin Cohorts read-only screen added with typed frontend hook for `admins/cohorts`, URL-backed search, status filters, pagination, student-count/self-paced visibility, and no creation, editing, assignment, group-link, or status controls.
- Phase 5 Admin Programs read-only screen added with typed frontend hook for `admins/programs`, URL-backed search, active/inactive filters, pagination, domain/status visibility, and no creation, editing, activation, or catalog publishing controls.
- Phase 5 Admin Projects read-only screen added with typed frontend hooks for `admins/projects` and `admins/project-roles`, URL-backed view/search/status/program/role filters, pagination, parsed tasks/documents/deliverables, safe external document links, tab-scoped data fetching, and no project creation, editing, role mapping, file, status, or submission controls.
- Phase 5 Admin Project Submissions read-only screen added with typed frontend hook for `admins/project-submissions`, URL-backed search/status/program/role/cohort/submitted-date filters, pagination, duplicate/repeat-attempt annotations, safe submission links, and no start-review, approve, reject, feedback, resubmission, status-change, or audit-write controls.
- Phase 5 Admin Resources read-only screen added with typed frontend hook for `admins/resources`, URL-backed search/status/access filters, pagination, audience mapping, safe resource links, and no upload, edit, URL replacement, pricing, audience mapping, activation, deletion, or storage-write controls.
- Phase 5 Admin Workshops read-only screen added with typed frontend hook for `admins/workshops`, URL-backed search/status/access filters, pagination, audience mapping, meeting labels, safe join/recording/payment links exposed by Nest, and no private start URL, schedule, provider, status, recording-publication, payment-link, or audience-mapping write controls.
- Phase 5 Admin Recording Candidates read-only screen added with typed frontend hook for `admins/recording-candidates`, URL-backed search/status/workshop/Zoom-account filters, pagination, file/review metadata, safe play/download links, and no review, reject, publish, workshop attachment, URL replacement, or deletion controls.
- Phase 5 Admin Certificates read-only screen added with typed frontend hook for `admins/certificates`, URL-backed search/status/generation/type filters, pagination, safe certificate metadata, and no private PDF storage path, generation, download, revoke, reissue, or manual status controls.
- Phase 5 Admin Certificate Requests read-only screen added with typed frontend hook for `admins/certificate-requests`, URL-backed search/moderator-status/admin-status filters, pagination, review metadata, and no submission token, private note, approval, rejection, issuance, generation-job, or PDF workflow controls.
- Phase 5 Admin Enrollments read-only screens added with typed frontend hooks for `admins/enrollment-requests`, `admins/enrollment-requests/:requestId`, `admins/enrollment-exceptions`, and `admins/enrollment-webhook-events`, URL-backed operational filters, bounded pagination/detail records, sanitized metadata, and no activation, cohort assignment, payment reconciliation, exception resolution, raw payload, signature, replay, retry, or status mutation controls.
- Phase 5 Admin Payment Orders and Paid Access read-only screens added with typed frontend hooks for `admins/payment-orders` and `admins/paid-access`, URL-backed search/status/item-type filters, pagination, operational payment/access metadata, and no Razorpay signature material, verification, refund, reconciliation, grant, revoke, expiry adjustment, entitlement repair, or manual status controls.
- Phase 5 Admin Community backend contract gap recorded; no guessed UI or table dependency was added.
- Phase 5 route-level page loading added; the prior Vite chunk-size warning no longer appears in `npm run web:build`.

## Automated Verification

All checks passed:

```txt
npm run typecheck
npm test
npm run lint
npm run build
```

`npm audit --audit-level=moderate` was not rerun after the latest student read endpoints because the network approval prompt was interrupted. The dependency graph did not change in these steps; the last completed audit before these endpoints reported `0 vulnerabilities`.

Current automated test count:

```txt
112 test suites passed
443 tests passed
Last completed npm audit before these read endpoints: 0 vulnerabilities
```

## Runtime Dependency Guardrail

No runtime source/config references were found for:

- `script.google.com`
- `SpreadsheetApp`
- `appsscript`
- fallback/legacy implementation markers

Documentation may mention Google Sheets or Apps Script only as explicit prohibited architecture.

## Manual Review Notes

- Supabase JWT validation is centralized in `SupabaseAuthGuard`.
- The verified bearer token is preserved as request context for auth-aware Supabase RPC calls.
- Service-role Supabase access is currently limited to server-owned profile lookup after JWT verification.
- Student dashboard uses one user-context Supabase client per request, reused across dashboard RPCs.
- Student announcement reads use the existing `student_dashboard_bundle` RPC, preserving active-date and audience visibility while excluding internal/admin-only fields.
- Student certificate reads are owner-scoped to the authenticated student's normalized email and exclude revoked certificates, student echo fields, and private PDF storage internals.
- Student cohort reads use the existing `student_dashboard_bundle` RPC, preserving audience visibility while excluding Google Group/internal cohort fields.
- Student paid access reads are owner-scoped to the authenticated student's normalized email and exclude internal notes.
- Student payment order reads are owner-scoped to the authenticated student's normalized email and exclude Razorpay signature material.
- Student project catalog reads use the existing `student_projects_bundle` RPC and expose parsed project tasks/documents/deliverables without internal admin fields.
- Student project submission reads are owner-scoped to the authenticated student's normalized email and exclude student echo fields/raw payload blobs.
- Student recording reads use the existing `student_dashboard_bundle` RPC, include only completed published recordings, and omit locked paid recording URLs.
- Student resource reads use the existing `student_resources_view` RPC, preserving Supabase audience matching and paid-resource lock behavior.
- Student schedule reads use the existing `student_schedule_view` RPC, preserving Supabase audience matching and paid-workshop lock behavior while excluding Zoom/admin fields.
- Student support ticket reads are owner-scoped to the authenticated student's normalized email.
- Student support ticket detail reads include public messages only and do not expose author email addresses.
- Admin dashboard reuses the already-authorized admin from `AdminGuard` instead of re-querying profile state.
- Admin and student inactive profiles are blocked.
- Dashboard aggregate reads stay in Supabase RPCs, which keeps Nest request handlers bounded.
- Admin announcement reads are paginated and exclude internal fields not needed by the list UI.
- Admin certificate registry reads are paginated and exclude private PDF storage internals.
- Admin certificate request queue reads are paginated and exclude submission token/private review-note internals.
- Admin enrollment request reads are paginated and exclude raw payload/mapped/custom field blobs from list responses.
- Admin enrollment request detail reads are bounded and exclude raw payload/status-history detail blobs.
- Admin enrollment exception reads are paginated and exclude raw payload/suggested mapping blobs from list responses.
- Admin enrollment webhook event reads are paginated and exclude raw webhook payload blobs from list responses.
- Admin paid access reads are paginated and expose entitlement grant metadata for active admins only.
- Admin payment order reads are paginated and exclude Razorpay signature material.
- Admin project catalog reads are paginated and expose parsed tasks/documents/deliverables without internal write-only fields.
- Admin project role catalog reads are paginated and exclude role mapping/write-only internals.
- Admin project submission reads are paginated, support review-queue filters, and annotate repeat submissions without exposing raw payload blobs.
- Admin recording candidate reads are paginated, admin-only, and expose draft/review metadata without making candidates student-visible.
- Admin support ticket queue reads are paginated and exclude ticket body/attachment storage internals.
- Admin support ticket detail reads cap message threads and do not expose attachment storage internals.
- Admin workshop reads are paginated and include operational meeting metadata without exposing private Zoom start URLs.
- Razorpay webhook intake verifies signatures and can persist verified events only when `RAZORPAY_WEBHOOK_PERSISTENCE_ENABLED=true`; the default path makes no Supabase write attempt.
- Razorpay payment order transitions are deterministic and can write only when `RAZORPAY_PAYMENT_ORDER_TRANSITIONS_ENABLED=true`, after a webhook event is newly persisted.
- Razorpay webhook event status recording runs only for newly persisted webhook events and skips duplicate webhook reprocessing.
- Enrollment activation now has a disabled-by-default executor shell; no live activation route calls it, and no Supabase activation writes are active by default.
- Enrollment activation source loading can build a local plan from Supabase-backed source rows but is not wired to a live activation trigger.
- Enrollment activation workflow is internal only and is not called by controllers or Razorpay webhook processing.
- Razorpay activation trigger decision is now reported by webhook responses, allows only newly persisted paid payment-order updates, and does not call activation.
- Supabase write-readiness is documented separately and does not authorize database changes by itself.
- Project submission creation now has a disabled-by-default executor shell; no live submission route calls it, and no Supabase project submission writes are active by default.
- Project submission source loading can build a local plan from Supabase-backed source rows but is not wired to a live submission endpoint.
- Admin project submission review source loading can build a local review plan from one Supabase-backed project submission row but is not wired to a live review endpoint.
- Admin project submission review now has a disabled-by-default executor shell; no live review route calls it, and no Supabase review writes are active by default.
- Admin project submission review workflow is internal only and is not called by controllers.
- Support ticket creation source loading can build a local creation plan from one Supabase-backed active student row but is not wired to a live support endpoint.
- Support ticket creation now has a disabled-by-default executor shell; no live support route calls it, and no Supabase support ticket writes are active by default.
- Support ticket creation workflow is internal only and is not called by controllers.
- Support ticket reply source loading can build a local reply plan from one Supabase-backed support ticket row but is not wired to a live reply endpoint.
- Support ticket reply now has a disabled-by-default executor shell; no live reply route calls it, and no Supabase reply writes are active by default.
- Support ticket reply workflow is internal only and is not called by controllers.
- Support ticket status transition source loading can build a local status transition plan from one Supabase-backed support ticket row but is not wired to a live status endpoint.
- Support ticket status transition now has a disabled-by-default executor shell; no live status route calls it, and no Supabase status writes are active by default.
- Support ticket status transition workflow is internal only and is not called by controllers.
- Certificate request approval planning is local only; no certificate approval live controller, storage writer, job runner, or live controller wiring exists yet.
- Certificate request approval source loading can build a local approval plan from one Supabase-backed certificate request row but is not wired to a live approval endpoint.
- Certificate request approval now has a disabled-by-default executor shell; no live approval route calls it, and no Supabase certificate approval writes are active by default.
- Certificate request approval workflow is internal only and is not called by controllers.
- Certificate generation finalization planning is local only; no storage writer, finalization live controller, job runner, or live controller wiring exists yet.
- Certificate generation finalization source loading can build a local finalization plan from one Supabase-backed generation job row but is not wired to a live job runner.
- Certificate generation finalization now has a disabled-by-default executor shell; no live job runner calls it, and no Supabase certificate finalization writes are active by default.
- Certificate generation finalization workflow is internal only and is not called by controllers or job runners.
- Certificate PDF render planning is local only; no storage writer, job runner, or live controller wiring exists yet.
- Certificate PDF render source loading can build a local render plan from one Supabase-backed generation job row but is not wired to a live renderer or job runner.
- Certificate PDF render-start now has a disabled-by-default executor shell; no live renderer or job runner calls it, and no Supabase render-start writes are active by default.
- Certificate PDF rendering now produces a local PDF buffer and SHA-256 metadata from a render plan without storage or Supabase writes.
- Certificate PDF storage now has a disabled-by-default writer shell; no live job runner calls it, and no Supabase Storage writes are active by default.
- Certificate PDF generation workflow is internal only, calls finalization only after storage upload succeeds, and is not wired to a controller, scheduler, or job runner.
- Workshop status transition planning is local only; no workshop status scheduler, Zoom provider integration, recording publication writer, or live controller wiring exists yet.
- Workshop status transition source loading can build a local status transition plan from one Supabase-backed workshop row but is not wired to a live status endpoint.
- Workshop status transition now has a disabled-by-default executor shell; no live status route calls it, and no Supabase workshop status writes are active by default.
- Workshop status transition workflow is internal only and is not called by controllers.
- Recording candidate review planning is local only; no recording publication writer or live controller wiring exists yet.
- Recording candidate review planning does not publish recordings to student-facing workshop fields.
- Recording candidate review source loading can build a local review plan from one Supabase-backed recording candidate row but is not wired to a live review endpoint.
- Recording candidate review now has a disabled-by-default executor shell; no live review route calls it, and no Supabase recording candidate review writes are active by default.
- Recording candidate review workflow is internal only and is not called by controllers.
- Recording publication planning is local only; no live controller wiring exists yet.
- Recording publication planning refuses to overwrite existing published recording URLs and requires reviewed candidates plus completed workshops.
- Recording publication source loading can build a local publication plan from one Supabase-backed workshop row and one recording candidate row.
- Recording publication now has a disabled-by-default executor shell; no live publication route calls it, and no Supabase recording publication writes are active by default.
- Recording publication workflow is internal only and is not called by controllers.
- Email outbox planning is local only; no provider integration, outbox executor, retry worker, live controller wiring, or Supabase email writes exist yet.
- Email outbox planning escapes rendered template values and associates email intent with a business entity before any future enqueue/write path.
- Email outbox source loading can build a local email outbox plan from one active Supabase-backed template row but is not wired to a live email enqueue endpoint.
- Email outbox now has a disabled-by-default executor shell; no live email route or worker calls it, and no Supabase email outbox writes are active by default.
- Email outbox workflow is internal only and is not called by controllers or workers.
- Email dispatch planning is local only; no provider integration, dispatch loader, dispatch executor, retry worker, live controller wiring, or Supabase dispatch writes exist yet.
- Email dispatch planning creates sending-lock intent and blocks locked/future-scheduled/attempt-exhausted jobs before any future provider send path.
- Email dispatch source loading can build a local dispatch plan from one Supabase-backed email outbox row but is not wired to a live worker or provider send path.
- Email dispatch now has a disabled-by-default executor shell; no live worker calls it, no provider send occurs, and no Supabase dispatch writes are active by default.
- Email dispatch workflow is internal only and is not called by controllers or workers.
- Email delivery result planning is local only; no provider integration, result writer, retry worker, live controller wiring, or Supabase result writes exist yet.
- Email delivery result source loading can build a local result plan from one Supabase-backed email outbox row but is not wired to a live worker, provider send path, or result writer.
- Email delivery result now has a disabled-by-default executor shell; no live worker calls it, no provider send occurs, and no Supabase result writes are active by default.
- Email delivery result workflow is internal only and is not called by controllers or workers.

## Residual Risk Before Next Phase

- Real Supabase staging smoke tests have not been run yet because local staging secrets/tokens are not configured in this repo.
- The current service uses existing Supabase RPC contracts; those RPCs should be verified in staging with real student/admin tokens.
- Load testing has not started yet. The code is structured for bounded calls, but performance must be measured with realistic traffic.

## Follow-Up Added

- Added a read-only local smoke-test harness for staging token verification.
- Added an explicit `ENABLE_API_DOCS` configuration flag so Swagger docs are disabled unless intentionally enabled.
- Added a read-only student announcements endpoint.
- Added a read-only student certificate endpoint.
- Added a read-only student cohorts endpoint.
- Added a read-only student paid access endpoint.
- Added a read-only student payment order endpoint.
- Added a read-only student project catalog endpoint.
- Added a read-only student project submission history endpoint.
- Added a read-only student recordings endpoint.
- Added a read-only student resource library endpoint.
- Added a read-only student upcoming schedule endpoint.
- Added read-only student support ticket list and detail endpoints.
- Added a read-only admin announcement list endpoint.
- Added a read-only admin certificate registry endpoint.
- Added a read-only admin certificate request queue endpoint.
- Added a read-only admin enrollment request queue endpoint.
- Added a read-only admin enrollment request detail endpoint.
- Added a read-only admin enrollment exception queue endpoint.
- Added a read-only admin enrollment webhook event queue endpoint.
- Added a read-only admin paid access endpoint.
- Added a read-only admin payment order endpoint.
- Added a read-only admin project catalog endpoint.
- Added a read-only admin project role catalog endpoint.
- Added a read-only admin project submission review queue endpoint.
- Added a read-only admin recording candidate list endpoint.
- Added a read-only admin support ticket queue endpoint.
- Added a disabled-by-default Razorpay webhook persistence adapter.
- Added a local Razorpay payment order transition planner.
- Added a disabled-by-default Razorpay payment order transition writer.
- Added Razorpay webhook event status recording after local processing.
- Added a local enrollment activation planner with activation precondition checks and idempotency keys.
- Added a disabled-by-default enrollment activation executor shell.
- Added an enrollment activation source loader.
- Added an internal enrollment activation workflow boundary.
- Added Razorpay enrollment activation trigger decision reporting to webhook responses.
- Added a Phase 4 Supabase write-readiness checklist.
- Added a local project submission planner.
- Added a project submission source loader.
- Added a disabled-by-default project submission executor shell.
- Added a local admin project submission review planner.
- Added an admin project submission review source loader.
- Added a disabled-by-default admin project submission review executor shell.
- Added an internal admin project submission review workflow boundary.
- Added a local student support ticket creation planner.
- Added a support ticket creation source loader.
- Added a disabled-by-default support ticket creation executor shell.
- Added an internal support ticket creation workflow boundary.
- Added a local support ticket reply planner.
- Added a support ticket reply source loader.
- Added a disabled-by-default support ticket reply executor shell.
- Added an internal support ticket reply workflow boundary.
- Added a local support ticket status transition planner.
- Added a support ticket status transition source loader.
- Added a disabled-by-default support ticket status transition executor shell.
- Added an internal support ticket status transition workflow boundary.
- Added a local certificate request approval planner.
- Added a certificate request approval source loader.
- Added a disabled-by-default certificate request approval executor shell.
- Added an internal certificate request approval workflow boundary.
- Added a local certificate generation finalization planner.
- Added a certificate generation finalization source loader.
- Added a disabled-by-default certificate generation finalization executor shell.
- Added an internal certificate generation finalization workflow boundary.
- Added a local certificate PDF render planner.
- Added a certificate PDF render source loader.
- Added a disabled-by-default certificate PDF render-start executor shell.
- Added a local certificate PDF renderer service.
- Added a disabled-by-default certificate PDF storage writer shell.
- Added an internal certificate PDF generation workflow boundary.
- Added a local workshop status transition planner.
- Added a workshop status transition source loader.
- Added a disabled-by-default workshop status transition executor shell.
- Added an internal workshop status transition workflow boundary.
- Added a local recording candidate review planner.
- Added a recording candidate review source loader.
- Added a disabled-by-default recording candidate review executor shell.
- Added an internal recording candidate review workflow boundary.
- Added a local recording publication planner.
- Added a recording publication source loader.
- Added a disabled-by-default recording publication executor shell.
- Added an internal recording publication workflow boundary.
- Added a read-only admin support ticket detail/thread endpoint.
- Added a read-only admin workshop/meeting list endpoint.
- Restored the Razorpay/payment module foundation after the business decision changed back to preserving current payment behavior.
- Added read-only admin support queue and support ticket detail UI screens.
- Admin support UI consumes the bounded Nest support endpoints and exposes no reply, assignment, escalation, internal-note, attachment, status-transition, close, or reopen controls.

## QA Verdict

The current foundation is clean enough to proceed to staging environment wiring and real Supabase smoke tests.
