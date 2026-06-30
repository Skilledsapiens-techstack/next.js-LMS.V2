# Migration Phases

## Phase 1: Foundation

- Nest.js application shell.
- Environment validation.
- Supabase service boundary.
- Health checks.
- API versioning.
- Validation, logging, throttling, and secure headers.

## Phase 2: Student Portal

- Authenticated dashboard.
- Course and cohort access.
- Resources and recordings.
- Project submissions.
- Certificate visibility.

## Phase 3: Admin Portal

- Admin identity and roles.
- Student management.
- Enrollment management.
- Project review.
- Certificate management.
- Support and audit views.

## Phase 4: Critical Workflows

- Razorpay webhook intake and payment event processing.
- Enrollment activation and access workflows.
- Certificate PDF generation.
- Email orchestration.
- Background cleanup.

Write workflow implementation is gated by `docs/PHASE_4_WRITE_WORKFLOW_DESIGN.md`.
Supabase write execution readiness is gated by `docs/PHASE_4_SUPABASE_WRITE_READINESS.md`.

## Phase 5: UI Foundation And Read-Only Portal Migration

- Frontend scaffold.
- UI migration map.
- Auth/session shell.
- Student/admin layouts.
- API client and query cache.
- Read-only student LMS screens.
- Read-only admin LMS screens.
- Disabled/feature-flagged write actions.

Phase 5 development is guided by `docs/DEVELOPMENT_CYCLE_GUIDE.md`.
Phase 5 route migration is mapped in `docs/PHASE_5_UI_MIGRATION_MAP.md`.

## Phase 6: Controlled Write Enablement

- Resolve approved Supabase write-side gaps.
- Enable write gates workflow-by-workflow.
- Run controlled staging write smoke tests.
- Verify current HTML app impact after each shared-data test.
- Document rollback/cleanup steps.

## Phase 7: Hardening

- Load testing for 1000+ concurrent active members.
- Security review.
- RLS review.
- Storage access review.
- Observability and alerting.

## Phase 8: Beta, Cutover, And Retirement

- Internal beta.
- Limited student/admin beta.
- Parallel observation with the current HTML app.
- Production cutover.
- Legacy HTML app retirement only after approval.
