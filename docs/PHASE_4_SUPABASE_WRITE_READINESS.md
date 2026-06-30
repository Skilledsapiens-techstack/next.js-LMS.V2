# Phase 4 Supabase Write Readiness

Date: 2026-06-27

## Purpose

Define the approval checklist before any Phase 4 Nest.js workflow is allowed to write to Supabase.

This is a readiness document only. It does not approve execution, and it does not change Supabase.

The first read-only Supabase discovery checkpoint is recorded in `docs/PHASE_4_SUPABASE_READONLY_AUDIT_20260627.md`.

The first read-only Supabase schema checkpoint is recorded in `docs/PHASE_4_SUPABASE_SCHEMA_AUDIT_20260627.md`.

## Current Default

All Phase 4 write gates must remain disabled unless a specific staging write test is approved:

- `RAZORPAY_WEBHOOK_PERSISTENCE_ENABLED=false`
- `RAZORPAY_PAYMENT_ORDER_TRANSITIONS_ENABLED=false`
- `ENROLLMENT_ACTIVATION_ENABLED=false`
- `COHORT_WRITES_ENABLED=false`
- `STUDENT_WRITES_ENABLED=false`
- `PROJECT_SUBMISSION_WRITES_ENABLED=false`
- `PROJECT_SUBMISSION_REVIEW_WRITES_ENABLED=false`
- `SUPPORT_TICKET_CREATION_WRITES_ENABLED=false`
- `SUPPORT_TICKET_REPLY_WRITES_ENABLED=false`
- `SUPPORT_TICKET_STATUS_WRITES_ENABLED=false`
- `WORKSHOP_STATUS_WRITES_ENABLED=false`
- `WORKSHOP_MEETING_PROVIDER_ENABLED=false`
- `WORKSHOP_MEETING_SCHEDULE_WRITES_ENABLED=false`
- `RECORDING_CANDIDATE_REVIEW_WRITES_ENABLED=false`
- `RECORDING_PUBLICATION_WRITES_ENABLED=false`
- `EMAIL_OUTBOX_WRITES_ENABLED=false`
- `EMAIL_DISPATCH_WRITES_ENABLED=false`
- `EMAIL_DELIVERY_RESULT_WRITES_ENABLED=false`
- `EMAIL_PROVIDER_SENDS_ENABLED=false`
- `CERTIFICATE_REQUEST_APPROVAL_WRITES_ENABLED=false`
- `CERTIFICATE_GENERATION_FINALIZATION_WRITES_ENABLED=false`
- `CERTIFICATE_PDF_RENDER_START_WRITES_ENABLED=false`
- `CERTIFICATE_PDF_STORAGE_WRITES_ENABLED=false`
- `BACKGROUND_CLEANUP_WRITES_ENABLED=false`

The current HTML application remains live and may rely on the same Supabase data. Do not enable any write gate against shared staging or production data without explicit approval.

Run the local gate audit before any approval request:

```bash
npm run audit:phase4-gates
```

The audit is local-only. It verifies that every Phase 4 gate is documented and disabled by default in the Nest.js repo.

## Required Supabase Verification

Before enabling any write gate, confirm the affected tables and columns exist exactly as expected.

### Razorpay Webhook Events

Required table:

- `enrollment_webhook_events`

Required fields:

- `event_id`
- `event_type`
- `payment_id`
- `order_id`
- `request_id`
- `status`
- `payload`
- `error_message`
- `processed_at`
- `created_at`

Required constraints and indexes:

- Unique constraint or unique index on `event_id`.
- Index on `status`.
- Index on `payment_id`.
- Index on `order_id`.
- Index on `processed_at`.

### Payment Orders

Required table:

- `payment_orders`

Required fields:

- `order_id`
- `razorpay_order_id`
- `razorpay_payment_id`
- `student_email`
- `item_type`
- `item_id`
- `amount`
- `currency`
- `status`
- `updated_at`

Required constraints and indexes:

- Index on `razorpay_order_id`.
- Index on `razorpay_payment_id`.
- Index on `student_email`.
- Index on `status`.
- Status values must support `created`, `paid`, `failed`, and `cancelled`.

### Enrollment Activation

Required tables:

- `enrollment_requests`
- `enrollment_request_items`
- `enrollment_status_history`
- `students`
- `student_programs`
- `student_cohorts`
- `paid_access`
- `audit_logs`

Required idempotency support:

- `students.email` must be unique or safely upsertable.
- `student_programs.idempotency_key` must be unique.
- `student_cohorts.idempotency_key` must be unique.
- `paid_access.access_id` must be unique.
- `enrollment_status_history.idempotency_key` must be unique.
- `audit_logs.idempotency_key` must be unique.

Required indexes:

- `enrollment_requests.order_id`
- `enrollment_requests.payment_id`
- `enrollment_requests.request_id`
- `enrollment_request_items.request_id`
- `enrollment_request_items.item_id`
- `students.email`
- `paid_access.student_email`
- `paid_access.item_type, item_id`

### Project Submission Writes

Required tables:

- `project_submission_requests`
- `project_submission_student_limits`
- `audit_logs`

Required fields:

- `project_submission_requests.request_id`
- `project_submission_requests.request_number`
- `project_submission_requests.student_email`
- `project_submission_requests.project_id`
- `project_submission_requests.submission_link`
- `project_submission_requests.attempt_number`
- `project_submission_requests.status`
- `project_submission_requests.reviewed_by`
- `project_submission_requests.reviewed_at`
- `project_submission_requests.review_notes`
- `project_submission_requests.idempotency_key`
- `project_submission_student_limits.idempotency_key`
- `project_submission_student_limits.student_email`
- `project_submission_student_limits.project_id`
- `project_submission_student_limits.attempt_count`
- `project_submission_student_limits.last_request_id`
- `audit_logs.idempotency_key`

Required constraints and indexes:

- `project_submission_requests.idempotency_key` must be unique.
- `project_submission_student_limits.idempotency_key` must be unique.
- `audit_logs.idempotency_key` must be unique.
- Index on `project_submission_requests.student_email`.
- Index on `project_submission_requests.project_id`.
- Index on `project_submission_requests.status`.
- Index on `project_submission_requests.reviewed_by`.
- Index on `project_submission_student_limits.student_email, project_id`.

### Support Ticket Writes

Required tables:

- `support_tickets`
- `support_ticket_messages`
- `audit_logs`

Required fields:

- `support_tickets.id`
- `support_tickets.ticket_id`
- `support_tickets.student_email`
- `support_tickets.student_name`
- `support_tickets.category_name`
- `support_tickets.priority`
- `support_tickets.subject`
- `support_tickets.status`
- `support_tickets.conversation_mode`
- `support_tickets.idempotency_key`
- `support_tickets.updated_at`
- `support_tickets.last_message_at`
- `support_tickets.last_student_reply_at`
- `support_tickets.last_admin_reply_at`
- `support_ticket_messages.id`
- `support_ticket_messages.ticket_id`
- `support_ticket_messages.author_role`
- `support_ticket_messages.author_email`
- `support_ticket_messages.author_name`
- `support_ticket_messages.body`
- `support_ticket_messages.visibility`
- `support_ticket_messages.idempotency_key`
- `audit_logs.idempotency_key`

Required constraints and indexes:

- `support_tickets.idempotency_key` must be unique.
- `support_ticket_messages.idempotency_key` must be unique.
- `audit_logs.idempotency_key` must be unique.
- Index on `support_tickets.student_email`.
- Index on `support_tickets.status`.
- Index on `support_tickets.priority`.
- Index on `support_tickets.updated_at`.
- Index on `support_ticket_messages.ticket_id`.
- Index on `support_ticket_messages.visibility`.

### Workshop Status Writes

Required tables:

- `workshops`
- `audit_logs`

Required fields:

- `workshops.id`
- `workshops.workshop_id`
- `workshops.title`
- `workshops.workshop_status`
- `workshops.updated_at`
- `audit_logs.idempotency_key`
- `audit_logs.actor_type`
- `audit_logs.actor_id`
- `audit_logs.entity_table`
- `audit_logs.entity_id`
- `audit_logs.action`
- `audit_logs.previous_state`
- `audit_logs.next_state`

Required constraints and indexes:

- `workshops.id` must be unique.
- `audit_logs.idempotency_key` must be unique.
- Index on `workshops.workshop_status`.
- Index on `workshops.updated_at`.

### Recording Candidate Review Writes

Required tables:

- `workshop_recording_candidates`
- `audit_logs`

Required fields:

- `workshop_recording_candidates.id`
- `workshop_recording_candidates.workshop_id`
- `workshop_recording_candidates.zoom_id`
- `workshop_recording_candidates.zoom_account`
- `workshop_recording_candidates.zoom_recording_file_id`
- `workshop_recording_candidates.play_url`
- `workshop_recording_candidates.download_url`
- `workshop_recording_candidates.status`
- `workshop_recording_candidates.reviewed_by`
- `workshop_recording_candidates.reviewed_at`
- `workshop_recording_candidates.updated_at`
- `audit_logs.idempotency_key`
- `audit_logs.actor_type`
- `audit_logs.actor_id`
- `audit_logs.entity_table`
- `audit_logs.entity_id`
- `audit_logs.action`
- `audit_logs.previous_state`
- `audit_logs.next_state`

Required constraints and indexes:

- `workshop_recording_candidates.id` must be unique.
- `audit_logs.idempotency_key` must be unique.
- Index on `workshop_recording_candidates.status`.
- Index on `workshop_recording_candidates.workshop_id`.
- Index on `workshop_recording_candidates.updated_at`.

### Certificate Request Approval Writes

Required tables:

- `certificate_requests`
- `certificate_generation_jobs`
- `audit_logs`

Required fields:

- `certificate_requests.request_id`
- `certificate_requests.admin_status`
- `certificate_requests.admin_email`
- `certificate_requests.admin_reviewed_at`
- `certificate_requests.updated_at`
- `certificate_generation_jobs.idempotency_key`
- `certificate_generation_jobs.request_id`
- `certificate_generation_jobs.certificate_id`
- `certificate_generation_jobs.certificate_type`
- `certificate_generation_jobs.status`
- `certificate_generation_jobs.requested_by`
- `certificate_generation_jobs.requested_at`
- `certificate_generation_jobs.payload`
- `audit_logs.idempotency_key`

Required constraints and indexes:

- `certificate_requests.request_id` must be unique or safely updateable.
- `certificate_generation_jobs.idempotency_key` must be unique.
- `audit_logs.idempotency_key` must be unique.
- Index on `certificate_requests.admin_status`.
- Index on `certificate_requests.moderator_status`.
- Index on `certificate_generation_jobs.status`.
- Index on `certificate_generation_jobs.request_id`.

### Certificate Generation Finalization Writes

Required tables:

- `certificates`
- `certificate_generation_jobs`
- `audit_logs`

Required fields:

- `certificates.certificate_id`
- `certificates.certificate_type`
- `certificates.student_email`
- `certificates.student_name`
- `certificates.issue_date`
- `certificates.status`
- `certificates.generation_status`
- `certificates.issued_by`
- `certificates.pdf_storage_bucket`
- `certificates.pdf_storage_path`
- `certificates.pdf_sha256`
- `certificates.source_request_id`
- `certificates.idempotency_key`
- `certificate_generation_jobs.idempotency_key`
- `certificate_generation_jobs.status`
- `certificate_generation_jobs.completed_at`
- `certificate_generation_jobs.storage_bucket`
- `certificate_generation_jobs.storage_path`
- `certificate_generation_jobs.pdf_sha256`
- `certificate_generation_jobs.updated_at`
- `audit_logs.idempotency_key`

Required constraints and indexes:

- `certificates.idempotency_key` must be unique.
- `certificates.certificate_id` must be unique.
- `certificate_generation_jobs.idempotency_key` must be unique.
- `audit_logs.idempotency_key` must be unique.
- Index on `certificates.student_email`.
- Index on `certificates.status`.
- Index on `certificates.generation_status`.
- Index on `certificate_generation_jobs.status`.

### Certificate PDF Render-Start Writes

Required tables:

- `certificate_generation_jobs`
- `audit_logs`

Required fields:

- `certificate_generation_jobs.idempotency_key`
- `certificate_generation_jobs.status`
- `certificate_generation_jobs.worker_id`
- `certificate_generation_jobs.started_at`
- `certificate_generation_jobs.updated_at`
- `audit_logs.idempotency_key`
- `audit_logs.actor_type`
- `audit_logs.actor_id`
- `audit_logs.entity_table`
- `audit_logs.entity_id`
- `audit_logs.action`
- `audit_logs.previous_state`
- `audit_logs.next_state`

Required constraints and indexes:

- `certificate_generation_jobs.idempotency_key` must be unique.
- `audit_logs.idempotency_key` must be unique.
- Index on `certificate_generation_jobs.status`.

### Certificate PDF Storage Writes

Required storage bucket:

- `certificates-private`

Required behavior:

- Bucket must be private.
- Uploads must use `application/pdf`.
- Uploads must use non-upsert writes unless a separate regeneration workflow is approved.
- Storage path must come from the local certificate PDF render plan.
- Storage write execution must be followed by certificate generation finalization only after the upload succeeds.

Required rollback evidence:

- Bucket name.
- Storage object path.
- PDF SHA-256 hash.
- Generation-job idempotency key.

### Email Outbox Writes

Required tables:

- `email_templates`
- `email_outbox`
- `audit_logs`
- `error_logs`

Required fields:

- `email_templates.key`
- `email_templates.subject`
- `email_templates.html_body`
- `email_templates.text_body`
- `email_templates.active`
- `email_outbox.idempotency_key`
- `email_outbox.template_key`
- `email_outbox.recipient_email`
- `email_outbox.recipient_name`
- `email_outbox.subject`
- `email_outbox.html_body`
- `email_outbox.text_body`
- `email_outbox.status`
- `email_outbox.priority`
- `email_outbox.entity_table`
- `email_outbox.entity_id`
- `email_outbox.entity_action`
- `email_outbox.requested_by`
- `email_outbox.requested_at`
- `email_outbox.correlation_id`
- `email_outbox.attempt_count`
- `audit_logs.idempotency_key`

Required constraints and indexes:

- `email_templates.key` must be unique.
- `email_outbox.idempotency_key` must be unique.
- `audit_logs.idempotency_key` must be unique.
- Index on `email_outbox.status`.
- Index on `email_outbox.priority`.
- Index on `email_outbox.recipient_email`.
- Index on `email_outbox.entity_table, entity_id`.
- Index on `email_outbox.requested_at`.

Required behavior:

- Provider credentials must stay server-only and must not be stored in email rows.
- Email provider calls must run from a retryable worker path, not inline with critical business writes.
- Failed sends must update outbox/error state without mutating payment, enrollment, certificate, support, project, or workshop business rows.

## RLS And Service-Role Boundary

- Student-facing APIs must use student-scoped reads or explicitly owner-scoped service-role reads.
- Admin APIs must require `AdminGuard`.
- Phase 4 write workflows must run server-side only.
- Service-role writes must never be exposed to browser clients.
- No student/admin response may expose raw webhook payloads, Razorpay signatures, service-role data, private storage paths, or internal audit payloads.

## Staging Write Test Order

Run only after explicit approval.

1. Confirm a fresh database backup exists.
2. Confirm write gates are disabled before the test.
3. Select one controlled test payment order and enrollment request.
4. Enable only `RAZORPAY_WEBHOOK_PERSISTENCE_ENABLED=true`.
5. Send one signed Razorpay webhook fixture.
6. Verify only `enrollment_webhook_events` changed.
7. Disable the gate.
8. Enable `RAZORPAY_WEBHOOK_PERSISTENCE_ENABLED=true` and `RAZORPAY_PAYMENT_ORDER_TRANSITIONS_ENABLED=true`.
9. Send one signed captured-payment fixture.
10. Verify webhook event status and payment order status changed as expected.
11. Disable both gates.
12. Review resulting rows for duplicates, incorrect statuses, or unexpected table changes.
13. Only after approval, test `ENROLLMENT_ACTIVATION_ENABLED=true` with one controlled enrollment request.
14. Verify student profile, program/cohort links, paid-access grant, status history, request status, and audit row.
15. Disable the activation gate.
16. Only after approval, test `PROJECT_SUBMISSION_WRITES_ENABLED=true` with one controlled student/project pair.
17. Verify project submission, student attempt-limit, and audit rows.
18. Disable all gates immediately after the test.
19. Only after approval, test `CERTIFICATE_REQUEST_APPROVAL_WRITES_ENABLED=true` with one controlled moderator-approved certificate request.
20. Verify certificate request admin status, generation-job row, and audit row.
21. Disable the certificate approval gate immediately after the test.

## Rollback And Stop Conditions

Stop immediately if any of these occur:

- Duplicate webhook rows are created.
- A paid order is downgraded.
- Activation creates duplicate student, cohort, program, or paid-access rows.
- Project submission creates duplicate submission, attempt-limit, or audit rows.
- Certificate approval creates duplicate generation jobs or audit rows.
- Any row changes outside the expected table set.
- The current HTML app shows inconsistent data after the test.
- Error rates or latency increase during testing.

Rollback must be planned before the test. At minimum, record all row IDs touched by the staging write test and confirm the restore strategy.

## Production Entry Criteria

Production write execution is blocked until:

- Staging write tests pass.
- Load-sensitive indexes are confirmed.
- RLS/service-role boundaries are reviewed.
- Rollback procedure is documented.
- Observability is available for webhook failures, payment transitions, activation failures, and duplicate events.
- Project submission write observability and idempotency checks are verified.
- Certificate approval write observability and idempotency checks are verified.
- The user explicitly approves production write execution.
