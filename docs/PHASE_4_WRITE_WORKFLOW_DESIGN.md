# Phase 4 Write Workflow Design

Date: 2026-06-27

## Purpose

Define the write workflow plan before Nest.js mutates Supabase data.

This document is a control gate. No Phase 4 write workflow should be implemented against Supabase until the affected workflow section has been reviewed and explicitly approved.

Supabase write readiness is tracked separately in `docs/PHASE_4_SUPABASE_WRITE_READINESS.md`.

The current local foundation checkpoint is tracked in `docs/PHASE_4_LOCAL_FOUNDATION_CHECKPOINT.md`.

## Non-Negotiables

- Supabase remains the only source of truth.
- No Google Sheet, Apps Script, retired function, or fallback path is allowed in Nest.js.
- The current HTML app remains live while this Nest.js repo is built separately.
- Any code that changes Supabase data requires explicit permission before implementation or execution.
- Write workflows must be idempotent, auditable, and safe to retry.
- Long-running work must move to jobs/workers instead of blocking request handlers.
- Student-facing data must never expose admin-only payloads, private storage paths, raw webhooks, signatures, or provider secrets.

## Current Phase 4 Baseline

Implemented locally:

- Razorpay webhook signature verification.
- Razorpay event normalization.
- Razorpay processing decision and persistence plan.
- Razorpay webhook event persistence adapter, disabled by default behind `RAZORPAY_WEBHOOK_PERSISTENCE_ENABLED=false`.
- Razorpay payment order transition planner for paid, failed, authorized, ignored, and missing-identity events.
- Razorpay payment order transition writer, disabled by default behind `RAZORPAY_PAYMENT_ORDER_TRANSITIONS_ENABLED=false`.
- Razorpay webhook event status recorder for processed, exception, skipped, duplicate, and failed outcomes.
- Local enrollment activation planner with idempotency keys for student, program, cohort, paid-access, status-history, and audit writes.
- Enrollment activation executor, disabled by default behind `ENROLLMENT_ACTIVATION_ENABLED=false` and not wired to a live endpoint.
- Enrollment activation source loader for payment order, enrollment request, and enrollment request item reads.
- Internal enrollment activation workflow that composes loader and gated executor without selecting a live trigger.
- Enrollment activation trigger decision reported by the Razorpay webhook path; not wired to execute activation.
- Local project submission planner with visibility, HTTPS link, attempt-limit, idempotency, limit-row, and audit planning.
- Project submission source loader for active student, active project, and existing submission reads.
- Project submission executor, disabled by default behind `PROJECT_SUBMISSION_WRITES_ENABLED=false` and not wired to a live endpoint.
- Local admin project submission review planner for start-review, approve, and reject transitions.
- Admin project submission review source loader for one project submission read and local review plan creation.
- Admin project submission review executor, disabled by default behind `PROJECT_SUBMISSION_REVIEW_WRITES_ENABLED=false` and not wired to a live endpoint.
- Internal admin project submission review workflow that composes loader and gated executor without selecting a live trigger.
- Local student support ticket creation planner with validation, idempotency, first-message, and audit planning.
- Support ticket creation source loader for active student read and local creation plan building.
- Support ticket creation executor, disabled by default behind `SUPPORT_TICKET_CREATION_WRITES_ENABLED=false` and not wired to a live endpoint.
- Internal support ticket creation workflow that composes loader and gated executor without selecting a live trigger.
- Local support ticket reply planner with student/admin visibility rules, message, status-update, and audit planning.
- Support ticket reply source loader for one support ticket read, student ownership enforcement, and local reply plan building.
- Support ticket reply executor, disabled by default behind `SUPPORT_TICKET_REPLY_WRITES_ENABLED=false` and not wired to a live endpoint.
- Internal support ticket reply workflow that composes loader and gated executor without selecting a live trigger.
- Local support ticket status transition planner with admin-only status-update and audit planning.
- Support ticket status transition source loader for one support ticket read and local status transition plan building.
- Support ticket status transition executor, disabled by default behind `SUPPORT_TICKET_STATUS_WRITES_ENABLED=false` and not wired to a live endpoint.
- Internal support ticket status transition workflow that composes loader and gated executor without selecting a live trigger.
- Local certificate request approval planner with admin approve/reject validation, generation-job intent, and audit planning.
- Certificate request approval source loader for one certificate request read and local approval plan building.
- Certificate request approval executor, disabled by default behind `CERTIFICATE_REQUEST_APPROVAL_WRITES_ENABLED=false` and not wired to a live endpoint.
- Internal certificate request approval workflow that composes loader and gated executor without selecting a live trigger.
- Local certificate generation finalization planner for completed private-storage PDF results.
- Certificate generation finalization source loader for one generation job read and local finalization plan building.
- Certificate generation finalization executor, disabled by default behind `CERTIFICATE_GENERATION_FINALIZATION_WRITES_ENABLED=false` and not wired to a live endpoint.
- Internal certificate generation finalization workflow that composes loader and gated executor without selecting a live trigger.
- Certificate PDF batch loader for bounded read-only selection of pending and stale-generating generation job keys for a future worker.
- Internal certificate PDF batch workflow that sequentially composes the batch loader and PDF generation workflow without a scheduler trigger.
- Local certificate PDF render planner for future render document model and private storage target creation.
- Certificate PDF render source loader for one generation job read and local render plan building.
- Certificate PDF render-start executor, disabled by default behind `CERTIFICATE_PDF_RENDER_START_WRITES_ENABLED=false` and not wired to a live renderer or job runner.
- Certificate PDF renderer service that creates deterministic local PDF bytes and SHA-256 metadata without storage or Supabase writes.
- Certificate PDF storage writer, disabled by default behind `CERTIFICATE_PDF_STORAGE_WRITES_ENABLED=false` and not wired to a live job runner.
- Internal certificate PDF generation workflow that composes loader, render-start executor, renderer, storage writer, and finalization workflow without selecting a live trigger.
- Local workshop status transition planner with conservative state changes and audit planning.
- Workshop status transition source loader for one workshop read and local status transition plan building.
- Workshop status transition executor, disabled by default behind `WORKSHOP_STATUS_WRITES_ENABLED=false` and not wired to a live endpoint.
- Internal workshop status transition workflow that composes loader and gated executor without selecting a live trigger.
- Provider-neutral workshop meeting boundary, disabled by default behind `WORKSHOP_MEETING_PROVIDER_ENABLED=false` with no Zoom/provider adapter or network call configured.
- Local workshop meeting scheduling planner for provider payload, future workshop update intent, and audit intent without provider calls or Supabase writes.
- Workshop meeting schedule executor, disabled by default behind `WORKSHOP_MEETING_SCHEDULE_WRITES_ENABLED=false` and not wired to a live endpoint or worker.
- Internal workshop meeting schedule workflow that composes planner, provider boundary, and gated executor without selecting a live trigger.
- Local recording candidate review planner with draft-only review/reject transitions and audit planning.
- Recording candidate review source loader for one candidate read and local review plan building.
- Recording candidate review executor, disabled by default behind `RECORDING_CANDIDATE_REVIEW_WRITES_ENABLED=false` and not wired to a live endpoint.
- Internal recording candidate review workflow that composes loader and gated executor without selecting a live trigger.
- Local recording publication planner for reviewed candidate publication onto completed workshops.
- Recording publication source loader for workshop/candidate reads and local publication plan building.
- Recording publication executor, disabled by default behind `RECORDING_PUBLICATION_WRITES_ENABLED=false` and not wired to a live endpoint.
- Internal recording publication workflow that composes loader and gated executor without selecting a live trigger.
- Local email outbox planner for deterministic, business-entity-associated email enqueue rows with server-side template rendering.
- Email outbox source loader for one active template read and local email outbox plan building.
- Email outbox executor, disabled by default behind `EMAIL_OUTBOX_WRITES_ENABLED=false` and not wired to a live endpoint or worker.
- Internal email outbox workflow that composes loader and gated executor without selecting a live trigger.
- Local email dispatch planner for provider-neutral pending-job dispatch decisions and sending-lock intent.
- Email dispatch batch loader for bounded read-only selection of due pending outbox job keys for a future worker.
- Internal email dispatch batch workflow that sequentially composes the batch loader and email send workflow without a scheduler trigger.
- Email dispatch source loader for one outbox-job read and local dispatch plan building.
- Email dispatch executor, disabled by default behind `EMAIL_DISPATCH_WRITES_ENABLED=false` and not wired to a live worker.
- Internal email dispatch workflow that composes loader and gated executor without selecting a live worker trigger.
- Provider-neutral email sender boundary, disabled by default behind `EMAIL_PROVIDER_SENDS_ENABLED=false` with no provider adapter or network call configured.
- Internal email send workflow that composes dispatch lock, provider sender boundary, and delivery-result recording without selecting a live worker trigger.
- Local email delivery result planner for provider-success and provider-failure update intent.
- Email delivery result source loader for one outbox-job read and local result plan building.
- Email delivery result executor, disabled by default behind `EMAIL_DELIVERY_RESULT_WRITES_ENABLED=false` and not wired to a live worker.
- Internal email delivery result workflow that composes loader and gated executor without selecting a live worker trigger.
- Local operational cleanup planner for stale email locks, abandoned certificate render jobs, processed webhook retention, and old error-log retention without live mutation.
- Operational cleanup source loader for bounded candidate reads across operational tables.
- Operational cleanup executor, disabled by default behind `BACKGROUND_CLEANUP_WRITES_ENABLED=false` and not wired to a live worker.
- Internal operational cleanup workflow that composes loader and gated executor without selecting a live worker trigger.
- Read-only student and admin API surfaces needed by the future UI.
- Read-only smoke-test harness.

Not implemented yet:

- Approved staging or production execution of Supabase writes from Razorpay webhooks.
- Approved staging or production execution of payment order updates from Razorpay webhooks.
- Approved live execution of enrollment activation.
- Approved live execution of paid access grant writes.
- Email provider dispatch and retry worker.
- Student/admin support replies and status writes.
- Approved live execution of student project submission creation.
- Approved live execution of admin project submission review writes.
- Approved live execution of support ticket creation writes.
- Approved live execution of support ticket reply writes.
- Approved live execution of support ticket status writes.
- Workshop scheduling or published recording writes.
- Approved live execution of background cleanup jobs.

## Implementation Order

1. Razorpay webhook persistence.
2. Payment order and webhook event state transitions.
3. Enrollment activation and paid access grants.
4. Student project submission writes and admin review writes.
5. Support ticket creation, replies, and status changes.
6. Certificate request approval and PDF generation jobs.
7. Workshop/recording write operations.
8. Email orchestration.
9. Background cleanup jobs.
10. Staging write smoke tests and rollback drills.

## Shared Write Rules

### Idempotency

Every external-event write must have a stable idempotency key.

- Razorpay event: `razorpay_event_id` when present; otherwise event plus payment/order identifiers.
- Payment order: `razorpay_order_id` or internal `order_id`.
- Enrollment activation: enrollment request ID plus target student email.
- Certificate generation: certificate request ID plus generation attempt.
- Email dispatch: template key plus recipient plus business entity ID.
- Project submission: request ID or student/project/attempt tuple.
- Support reply: server-generated reply ID plus ticket ID.

### Audit

Sensitive writes must append audit entries with:

- Actor type: `system`, `student`, or `admin`.
- Actor identity: normalized email or system worker name.
- Business entity: table and stable external ID.
- Action name.
- Previous state when practical.
- Next state.
- Correlation ID or request ID.

### Error Handling

- Store provider errors in operational/event tables, not in student-facing tables.
- Return success for duplicate already-processed webhook events when the stored result is consistent.
- Failed background work must be retryable.
- Partial activation must be detectable by status history and audit logs.

### Performance

- Writes should touch the minimum table set.
- Request handlers should avoid provider calls after verification when the provider call can be delayed.
- Batch/background jobs should cap page sizes.
- All list filters used by workers and write decisions must be backed by indexes before production load testing.

## Workflow 1: Razorpay Webhook Persistence

### Goal

Persist verified Razorpay events and make payment processing idempotent without activating access yet.

### Inputs

- Raw Razorpay webhook body.
- `x-razorpay-signature`.
- Configured webhook secret.

### Tables To Touch

- `enrollment_webhook_events`
- `payment_orders`
- `audit_logs` or equivalent audit table
- `error_logs` only for operational failures

### Required Behavior

- Verify signature before parsing trust-sensitive fields.
- Compute idempotency key.
- Insert webhook event if not already present.
- If duplicate, return the previously known processing state.
- Normalize payment ID, order ID, amount, currency, email, phone, and notes.
- Update matching payment order when safe.
- Do not activate enrollment or paid access in the first persistence slice.

### Safety Checks

- Reject missing webhook secret.
- Reject invalid signature.
- Reject unknown critical event shapes into skipped/recorded state, not crash loops.
- Never store Razorpay signature material in student/admin list responses.

### Approval Required

Yes. This workflow writes to Supabase and must be approved before implementation.

## Workflow 2: Payment Order State Transitions

### Goal

Keep payment order records aligned with verified Razorpay events.

### Tables To Touch

- `payment_orders`
- `enrollment_webhook_events`
- `audit_logs`

### Required Behavior

- Match by Razorpay order ID, Razorpay payment ID, or internal order ID.
- Set status transitions deterministically.
- Prevent a later failed/authorized event from downgrading a captured/paid order.
- Record processed/skipped/error state on the webhook event.

### Approval Required

Yes.

## Workflow 3: Enrollment Activation And Paid Access Grants

### Goal

Convert approved or paid enrollment intent into usable LMS access.

### Tables To Touch

- `enrollment_requests`
- `enrollment_request_items`
- `enrollment_request_status_history`
- `students`
- `student_programs`
- `student_cohorts`
- `paid_access`
- `audit_logs`

### Required Behavior

- Normalize student email.
- Find or create student profile only when activation rules allow it.
- Link selected cohorts/programs.
- Create paid access grants for paid resources/workshops/groups when applicable.
- Mark request status history.
- Be safe to retry without duplicating student/cohort/access rows.

### Approval Required

Yes.

## Workflow 4: Project Submission Writes

### Goal

Allow students to submit projects and admins to review them.

### Tables To Touch

- `project_submission_requests`
- `project_submission_student_limits`
- `audit_logs`
- Optional storage tables/buckets if file uploads are introduced

### Required Behavior

- Student can submit only for projects visible to them.
- Attempt number is computed server-side.
- Attempt limits are enforced server-side.
- Admin review transitions are auditable.
- Raw payloads/storage internals are not exposed through student list APIs.
- Current local executor writes only submission, attempt-limit, and audit rows when `PROJECT_SUBMISSION_WRITES_ENABLED=true`.
- The executor is not called by any controller or live workflow yet.
- Current local admin review planner permits `submitted -> under_review`, `submitted|under_review -> approved`, and `submitted|under_review -> rejected`.
- Current local admin review source loader reads one project submission by request ID and is not called by any controller or live workflow yet.
- Rejection requires a review note.
- Current local admin review executor writes only project-submission review updates and audit rows when `PROJECT_SUBMISSION_REVIEW_WRITES_ENABLED=true`.
- Current internal admin review workflow composes loader and executor but is not called by any controller or live workflow yet.

### Approval Required

Yes.

## Workflow 5: Support Ticket Writes

### Goal

Allow student ticket creation, student/admin replies, and status transitions.

### Tables To Touch

- `support_tickets`
- `support_ticket_messages`
- `audit_logs`
- Optional storage bucket for attachments

### Required Behavior

- Student can create and view only their own tickets.
- Admin can see queue and details.
- Internal admin messages remain hidden from students.
- Status changes are audited.
- Attachment support requires private storage policy and signed URLs.
- Current local support ticket creation planner requires student email, category, subject, and first message body.
- Current local support ticket creation planner produces ticket, first public message, and audit write rows.
- Current local support ticket creation source loader reads one active student by normalized email and is not called by any controller or live workflow yet.
- Current local support ticket creation executor writes only support ticket, first public message, and audit rows when `SUPPORT_TICKET_CREATION_WRITES_ENABLED=true`.
- Current internal support ticket creation workflow composes loader and executor but is not called by any controller or live workflow yet.
- Current local support ticket reply planner supports student public replies, admin public replies, and admin internal notes.
- Student internal replies, closed-ticket replies, and student replies to admin-only or resolved tickets are blocked.
- Current local support ticket reply source loader reads one support ticket by ID, enforces student ownership for student replies, and is not called by any controller or live workflow yet.
- Current local support ticket reply executor writes only reply message, support ticket update, and audit rows when `SUPPORT_TICKET_REPLY_WRITES_ENABLED=true`.
- Current internal support ticket reply workflow composes loader and executor but is not called by any controller or live workflow yet.
- Current local support ticket status transition planner supports admin transitions across open, in-review, waiting-for-student, resolved, and closed states.
- Resolution notes are required when resolving or closing a support ticket.
- Current local support ticket status transition source loader reads one support ticket by ID and is not called by any controller or live workflow yet.
- Current local support ticket status transition executor writes only support ticket update and audit rows when `SUPPORT_TICKET_STATUS_WRITES_ENABLED=true`.
- Current internal support ticket status transition workflow composes loader and executor but is not called by any controller.
- The support ticket status transition executor is not called by any controller or live workflow yet.

### Approval Required

Yes.

## Workflow 6: Certificate Generation

### Goal

Approve certificate requests and generate PDFs safely.

### Tables To Touch

- `certificate_requests`
- `certificates`
- Supabase Storage certificate bucket
- `audit_logs`
- Job table if background workers are introduced

### Required Behavior

- Admin approval creates a generation job, not a long HTTP request.
- PDF generation writes to private storage first.
- Certificate record references the final storage object.
- Public verification reads only safe certificate fields.
- Regeneration/revocation is auditable.
- Current local certificate request approval planner requires moderator approval before admin approval or rejection.
- Rejection requires an admin note.
- Current local certificate request approval planner produces certificate request update, generation-job intent for approvals, and audit intent.
- Current local certificate request approval source loader reads one certificate request by request ID and is not called by any controller or live workflow yet.
- Current local certificate request approval executor writes only certificate request update, generation-job intent, and audit rows when `CERTIFICATE_REQUEST_APPROVAL_WRITES_ENABLED=true`.
- Current internal certificate request approval workflow composes loader and executor but is not called by any controller.
- The certificate request approval executor is not called by any controller or live workflow yet.
- Current local certificate generation finalization planner produces certificate row, generation-job update, and audit intent from completed private-storage PDF metadata.
- Current local certificate generation finalization source loader reads one generation job by idempotency key and is not called by any controller or live workflow yet.
- Current local certificate generation finalization executor writes only certificate row, generation-job update, and audit rows when `CERTIFICATE_GENERATION_FINALIZATION_WRITES_ENABLED=true`.
- Current internal certificate generation finalization workflow composes loader and executor but is not called by any controller or job runner.
- The certificate generation finalization executor is not called by any controller or live workflow yet.
- Current local certificate PDF render planner produces render document, private storage target, job update intent, and audit intent without rendering or writing.
- Current local certificate PDF render source loader reads one generation job by idempotency key and is not called by any controller or job runner.
- Current local certificate PDF render-start executor writes only generation-job status update and audit rows when `CERTIFICATE_PDF_RENDER_START_WRITES_ENABLED=true`.
- The certificate PDF render-start executor is not called by any controller, renderer, or job runner yet.
- Current local certificate PDF renderer service creates PDF bytes and SHA-256 metadata from an already-approved render plan without reading or writing Supabase.
- Current local certificate PDF storage writer uploads rendered PDF bytes only when `CERTIFICATE_PDF_STORAGE_WRITES_ENABLED=true`.
- The certificate PDF storage writer is not called by any controller or job runner yet.
- Current internal certificate PDF generation workflow calls finalization only after storage upload succeeds and is not called by any controller, scheduler, or job runner.
- No certificate PDF job runner or live controller wiring exists yet.

### Approval Required

Yes.

## Workflow 7: Workshop And Recording Writes

### Goal

Support workshop scheduling/status updates and recording publication.

### Tables To Touch

- `workshops`
- `workshop_recording_candidates`
- `audit_logs`
- Optional Zoom provider logs

### Required Behavior

- Scheduling and Zoom provider calls should be isolated behind a service.
- Marking completed should not automatically publish draft recordings.
- Recording candidate review changes only candidate state.
- Publishing final recording writes `youtube_video_url` or `zoom_recording_url` to `workshops`.
- Student recording endpoint should continue to show only final published recordings.
- Current local workshop status transition planner supports conservative `Upcoming`, `Scheduled`, and `Live` state movement with audit intent.
- Current local workshop status transition planner blocks no-op transitions, missing identities, final-state changes, and unsafe status skips.
- Current local workshop status transition source loader reads one workshop by row ID and is not called by any controller or live workflow yet.
- Current local workshop status transition executor writes only workshop status update and audit rows when `WORKSHOP_STATUS_WRITES_ENABLED=true`.
- Current internal workshop status transition workflow composes loader and executor but is not called by any controller.
- The workshop status transition executor is not called by any controller or live workflow yet.
- Current local recording candidate review planner supports draft candidate review and rejection without publishing recordings to workshops.
- Current local recording candidate review planner blocks missing identities, already-final candidates, and candidates without a recording reference.
- Current local recording candidate review source loader reads one recording candidate by ID and is not called by any controller or live workflow yet.
- Current local recording candidate review executor writes only candidate review update and audit rows when `RECORDING_CANDIDATE_REVIEW_WRITES_ENABLED=true`.
- Current internal recording candidate review workflow composes loader and executor but is not called by any controller.
- The recording candidate review executor is not called by any controller or live workflow yet.
- Current local recording publication planner allows only reviewed candidates to publish onto completed workshops and refuses to overwrite existing published recording URLs.
- Current local recording publication planner produces workshop recording update and audit intent without writing Supabase.
- Current local recording publication source loader reads one workshop and one recording candidate into the local publication planner.
- Current local recording publication executor writes only workshop recording URL update and audit rows when `RECORDING_PUBLICATION_WRITES_ENABLED=true`.
- Current internal recording publication workflow composes loader and executor but is not called by any controller.
- The recording publication executor is not called by any controller or live workflow yet.
- No workshop scheduler, Zoom provider integration, or live controller wiring exists yet.

### Approval Required

Yes.

## Workflow 8: Email Orchestration

### Goal

Send operational emails without blocking critical requests.

### Tables To Touch

- `email_templates`
- Email job/outbox table if available or introduced
- `audit_logs`
- `error_logs`

### Required Behavior

- Template rendering is server-side.
- Email sends run through a retryable outbox/job path.
- Provider credentials stay server-only.
- Emails are associated with business entities.
- Failures do not corrupt enrollment/certificate/payment state.
- Current local email outbox planner builds pending email job row intent and audit intent from a server-rendered template.
- Current local email outbox planner escapes rendered template values and uses template key, recipient, business entity, and action for idempotency.
- Current email outbox source loader reads one active email template by key and is not called by any controller or live workflow yet.
- Current email outbox executor writes only pending email outbox rows and audit rows when `EMAIL_OUTBOX_WRITES_ENABLED=true`.
- Current internal email outbox workflow composes loader and executor but is not called by any controller or worker.
- Current local email dispatch planner builds provider-neutral dispatch payload and sending-lock intent without provider calls or Supabase writes.
- Current local email dispatch planner blocks non-pending, locked, future-scheduled, incomplete, or attempt-exhausted email jobs.
- Current email dispatch source loader reads one email outbox job by idempotency key and is not called by any controller or worker.
- Current email dispatch executor writes only the sending lock/update when `EMAIL_DISPATCH_WRITES_ENABLED=true`.
- Current internal email dispatch workflow composes loader and executor but is not called by any controller or worker.
- Current local email delivery result planner builds sent, retry-pending, terminal-failed, and provider-error-log intent without provider calls or Supabase writes.
- Current email delivery result source loader reads one email outbox job by idempotency key and is not called by any controller or worker.
- Current email delivery result executor writes only outbox result updates and provider error-log rows when `EMAIL_DELIVERY_RESULT_WRITES_ENABLED=true`.
- Current internal email delivery result workflow composes loader and executor but is not called by any controller or worker.
- No email provider integration, retry worker, or live controller wiring exists yet.

### Approval Required

Yes.

## Workflow 9: Background Cleanup

### Goal

Keep operational state healthy without manual cleanup.

### Candidate Jobs

- Expire paid access grants.
- Retry failed email jobs.
- Retry safe certificate generation jobs.
- Mark stale webhook events for review.
- Clean temporary storage objects.
- Summarize old provider logs.

### Required Behavior

- Jobs are bounded by batch size.
- Jobs are resumable.
- Jobs emit metrics/logs.
- Jobs do not delete business records unless explicitly designed and approved.

### Approval Required

Yes.

## Pre-Implementation Checklist For Each Write Workflow

- Confirm exact tables and columns.
- Confirm indexes needed for lookup and idempotency.
- Confirm RLS/service-role boundary.
- Confirm DTO validation.
- Confirm audit event shape.
- Confirm rollback or retry behavior.
- Confirm smoke test data.
- Get explicit Supabase write permission.

## Recommended Next Implementation Step

Continue with project submission source loading and disabled-by-default write executor planning:

- Keep `RAZORPAY_WEBHOOK_PERSISTENCE_ENABLED=false` until an approved write test.
- Keep `RAZORPAY_PAYMENT_ORDER_TRANSITIONS_ENABLED=false` until an approved write test.
- Keep `ENROLLMENT_ACTIVATION_ENABLED=false` until an approved write test.
- Keep the activation workflow uncalled by public routes/webhooks until trigger approval.
- Do not call `activateFromPayment` from the webhook until Supabase write approval is granted.
- Use `docs/PHASE_4_SUPABASE_WRITE_READINESS.md` as the staging write-test gate.
- Add a disabled-by-default project submission write executor.
- Keep project submission writes uncalled by public routes until approval.
- Do not activate enrollment yet.
- Run local tests and runtime scans.
- Ask for Supabase write permission only before real staging execution.
