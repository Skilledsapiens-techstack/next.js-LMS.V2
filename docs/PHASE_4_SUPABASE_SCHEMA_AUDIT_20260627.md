# Phase 4 Supabase Schema Audit

Date: 2026-06-27

## Scope

This checkpoint records the first read-only schema/index/storage audit against the linked Supabase project.

No Supabase writes were performed.
No migrations were run.
No schema changes were made.
No data changes were made.
No storage changes were made.
No secrets were changed.
No Edge Functions were deployed.
No Nest.js write gates were enabled.

## Local Link

The Nest.js repo was linked locally to project `olgihgkyteumndphxsut` to allow read-only CLI inspection.

Generated local files are limited to Supabase CLI metadata under `supabase/.temp`.

## Commands Used

Read-only commands:

```bash
supabase link --project-ref olgihgkyteumndphxsut
supabase inspect db table-stats --linked
supabase inspect db index-stats --linked
supabase migration list --linked
supabase db query --linked --file scripts/phase4-readonly-schema-audit.sql --output json
supabase db query --linked --file scripts/phase4-readonly-schema-gaps.sql --output table
```

The attempted schema dump was not completed because Supabase CLI requires Docker for `pg_dump`:

```bash
supabase db dump --linked --schema public,storage --file /private/tmp/lms-nestjs-public-storage-schema.sql
```

## Existing Surfaces Confirmed

The following important tables are present:

- `admin_users`
- `audit_logs`
- `certificate_requests`
- `certificates`
- `email_queue`
- `email_templates`
- `enrollment_request_items`
- `enrollment_requests`
- `enrollment_status_history`
- `enrollment_webhook_events`
- `error_logs`
- `paid_access`
- `payment_orders`
- `project_submission_requests`
- `project_submission_student_limits`
- `students`
- `student_cohorts`
- `student_programs`
- `support_ticket_messages`
- `support_tickets`
- `workshop_recording_candidates`
- `workshops`

The following read RPCs are present:

- `lms_admin_dashboard_summary`
- `lms_audience_matches`
- `lms_normalized_scope_values`
- `lms_program_keys_for_cohort_names`
- `lms_request_email`
- `lms_student_cohort_names`
- `lms_student_id_for_request`
- `lms_student_program_keys`
- `lms_workshop_program_keys`

Private storage buckets found:

- `certificate-pdfs`
- `support-ticket-attachments`

## Gaps Found

Required Phase 4 tables missing:

- `certificate_generation_jobs`
- `email_outbox`

Required Phase 4 columns missing:

- `audit_logs.idempotency_key`
- `certificate_generation_jobs.idempotency_key`
- `certificate_generation_jobs.pdf_sha256`
- `certificate_generation_jobs.request_id`
- `certificate_generation_jobs.status`
- `certificate_generation_jobs.storage_bucket`
- `certificate_generation_jobs.storage_path`
- `certificates.pdf_sha256`
- `certificates.pdf_storage_bucket`
- `email_outbox.idempotency_key`
- `email_outbox.recipient_email`
- `email_outbox.status`
- `email_outbox.template_key`
- `email_templates.html_body`
- `email_templates.text_body`
- `enrollment_status_history.idempotency_key`
- `project_submission_requests.idempotency_key`
- `project_submission_student_limits.idempotency_key`
- `project_submission_student_limits.project_id`
- `student_cohorts.idempotency_key`
- `student_programs.idempotency_key`
- `support_ticket_messages.idempotency_key`
- `support_tickets.idempotency_key`

Storage naming mismatch:

- Readiness plan expected `certificates-private`.
- Existing private bucket is `certificate-pdfs`.

## Interpretation

The current Supabase project is broadly ready for read-only LMS UI work because the main student/admin read tables and read RPCs exist.

The remaining gaps are mostly Phase 4 write-worker and idempotency structures. They should not be changed directly until we decide whether to:

1. Adapt the Nest.js workflows to existing live table/column names where safe.
2. Add new idempotency columns/tables through an approved migration.
3. Keep some workflows disabled until the live HTML app is ready for shared schema changes.

## Recommended Next Step

Start UI foundation and read-only LMS screens while keeping all write gates disabled.

Before enabling any Phase 4 write workflow, prepare a separate migration proposal for the missing idempotency/write-worker structures and review the impact on the live HTML application.
