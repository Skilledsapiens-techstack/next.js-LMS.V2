# Development Cycle Guide

Date: 2026-06-27

## Purpose

This document is the guiding principle for the Nest.js LMS rebuild.

Use it before starting any new development step so the project does not drift into unsafe rewrites, legacy fallback behavior, unplanned Supabase changes, or rushed UI work.

## Non-Negotiable Principles

- The existing HTML application remains live until a controlled cutover is approved.
- Supabase remains the single source of truth.
- No Google Sheet, Apps Script, fallback, retired, or parallel legacy runtime code is allowed.
- Nest.js is the backend boundary for the new portal UI.
- Browser code must never receive the Supabase service-role key.
- Supabase writes, migrations, storage changes, RLS changes, secrets, functions, and write-gate activation require explicit approval.
- New UI development starts read-only unless a write workflow has passed its own backend, Supabase, and staging approval.
- Code should stay easy to audit: small files, clear names, typed boundaries, explicit states, and no hidden business logic in UI components.

## Current Status

Completed:

- Phase 1 backend foundation.
- Phase 2 read-oriented student portal API surface.
- Phase 3 read-oriented admin portal API surface.
- Phase 4 local critical workflow foundation with all write/provider gates disabled by default.
- Read-only Supabase discovery and schema audit.

Current checkpoint:

- Local Phase 4 foundation: about 99%.
- Live Supabase write execution: 0% enabled by design.
- Supabase read-side contract: ready enough to begin UI foundation and read-only screens.
- Supabase write-side contract: gaps documented in `docs/PHASE_4_SUPABASE_SCHEMA_AUDIT_20260627.md`.
- Phase 5 frontend scaffold and initial visual foundation exist under `apps/web`.
- Phase 5 navigation now includes Community as a read-only student/admin module.
- Phase 5 API/auth foundation now has a browser session provider, password sign-in shell, and Nest API protected portal probes.
- Phase 5 shared component baseline now exists for page headers, filters, data panels, loading/empty/error/locked states, and disabled write actions.
- Phase 5 Student Dashboard read-only screen now consumes `GET /api/v1/students/me` and `GET /api/v1/students/me/dashboard`.
- Phase 5 Student Announcements read-only screen now consumes `GET /api/v1/students/me/announcements` with search, priority filters, and pagination.
- Phase 5 Student Cohorts read-only screen now consumes `GET /api/v1/students/me/cohorts` with search, status filters, and pagination.
- Phase 5 Student Resources read-only screen now consumes `GET /api/v1/students/me/resources` with search, access filters, type filters, pagination, and locked-content handling.
- Phase 5 Student Recordings read-only screen now consumes `GET /api/v1/students/me/recordings` with search, access/source filters, pagination, and locked playback handling.
- Phase 5 Student Schedule read-only screen now consumes `GET /api/v1/students/me/schedule` with search, access/status filters, pagination, and locked join-link handling.
- Phase 5 Student Projects read-only screen now consumes `GET /api/v1/students/me/projects` with search, program/role filters, pagination, and parsed project content.
- Phase 5 Student Project Submissions read-only screen now consumes `GET /api/v1/students/me/project-submissions` with search, status/program/cohort filters, pagination, and attempt history.
- Phase 5 Student Certificates read-only screen now consumes `GET /api/v1/students/me/certificates` with search, status/generation/type filters, pagination, and private PDF storage kept out of the UI.
- Phase 5 Student Payments read-only screen now consumes `GET /api/v1/students/me/payment-orders` with search, status/item-type filters, pagination, and payment mutation/signature workflows kept out of the UI.
- Phase 5 Student Paid Access read-only screen now consumes `GET /api/v1/students/me/paid-access` with search, status/item-type filters, pagination, active-now/expiry visibility, and grant/revoke workflows kept out of the UI.
- Phase 5 Student Support read-only list/detail screens now consume `GET /api/v1/students/me/support-tickets` and `GET /api/v1/students/me/support-tickets/:ticketId` with owned-ticket visibility, public messages only, and create/reply/internal workflows kept out of the UI.
- Phase 5 Student Community remains blocked until a real read-only Nest community endpoint/schema contract exists.
- Phase 5 Admin Dashboard read-only screen now consumes `GET /api/v1/admins/me` and `GET /api/v1/admins/dashboard` with defensive summary parsing and all admin write workflows kept out of the UI.
- Phase 5 Admin Announcements read-only screen now consumes `GET /api/v1/admins/announcements` with search, status/priority/audience filters, pagination, and create/edit/publish controls kept out of the UI.
- Phase 6 Admin Students now consumes `GET /api/v1/admins/students` with search, active/inactive filters, pagination, assignment visibility, and exposes audited create/update, deactivate/reactivate, CSV import, page CSV export, and LP attempt-limit controls behind `STUDENT_WRITES_ENABLED` for mutations.
- Phase 6 Admin Cohorts consumes `GET /api/v1/admins/cohorts` for the compact card view and exposes audited create, edit, deactivate, and reactivate/status updates behind `COHORT_WRITES_ENABLED`.
- Phase 5 Admin Programs read-only screen now consumes `GET /api/v1/admins/programs` with search, active/inactive filters, pagination, domain/status visibility, and catalog mutation controls kept out of the UI.
- Phase 5 Admin Projects read-only screen now consumes `GET /api/v1/admins/projects` and `GET /api/v1/admins/project-roles` with view/search/status/program/role filters, pagination, parsed project content, tab-scoped data fetching, and project/role mutation controls kept out of the UI.
- Phase 5 Admin Project Submissions read-only screen now consumes `GET /api/v1/admins/project-submissions` with search/status/program/role/cohort/submitted-date filters, pagination, duplicate/repeat annotations, safe submission links, and review mutation controls kept out of the UI.
- Phase 5 Admin Resources read-only screen now consumes `GET /api/v1/admins/resources` with search/status/access filters, pagination, audience mapping, safe resource links, and resource/storage mutation controls kept out of the UI.
- Phase 5 Admin Workshops read-only screen now consumes `GET /api/v1/admins/workshops` with search/status/access filters, pagination, audience mapping, meeting labels, safe join/recording/payment links exposed by Nest, and private start URL/provider/status/scheduling mutation controls kept out of the UI.
- Phase 5 Admin Recording Candidates read-only screen now consumes `GET /api/v1/admins/recording-candidates` with search/status/workshop/Zoom-account filters, pagination, file/review metadata, safe play/download links, and review/publication mutation controls kept out of the UI.
- Phase 5 Admin Certificates read-only screen now consumes `GET /api/v1/admins/certificates` with search/status/generation/type filters, pagination, safe certificate metadata, and private PDF/generation/download/revoke controls kept out of the UI.
- Phase 5 Admin Certificate Requests read-only screen now consumes `GET /api/v1/admins/certificate-requests` with search/moderator-status/admin-status filters, pagination, review metadata, and approval/rejection/issuance/token/private-note controls kept out of the UI.
- Phase 5 Admin Enrollments read-only screens now consume `GET /api/v1/admins/enrollment-requests`, `GET /api/v1/admins/enrollment-requests/:requestId`, `GET /api/v1/admins/enrollment-exceptions`, and `GET /api/v1/admins/enrollment-webhook-events` with bounded pagination/detail, sanitized metadata, and activation/resolution/replay/raw-payload controls kept out of the UI.
- Phase 5 Admin Payment Orders and Paid Access read-only screens now consume `GET /api/v1/admins/payment-orders` and `GET /api/v1/admins/paid-access` with search/status/item-type filters, pagination, operational payment/access metadata, and signature/refund/reconciliation/grant/revoke controls kept out of the UI.
- Phase 5 Admin Community remains blocked until a real read-only Nest community endpoint/schema contract exists.
- Phase 5 web routes use lazy page loading so initial bundle size stays controlled as screens grow.
- Phase 5B student UI/UX stabilization decisions and deferred write-work notes are documented in `docs/PHASE_5B_UI_UX_CHECKPOINT.md`.

## Local Login

The web app uses the configured auth provider only for browser session handling. LMS data still goes through Nest APIs.

Required local web environment:

```txt
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_WRITE_ACTIONS_ENABLED=false
```

Login flow:

1. Start the Nest API locally.
2. Start the web app locally.
3. Open `/login`.
4. Select Student or Admin.
5. Enter the registered email and password.
6. Student users go to `/student`; admin users go to `/admin`.

Current local limitation:

- Real login requires the registered user to have password sign-in enabled in the auth provider and to be linked to an active student or admin record.

## Phase Sequence

### Phase 1: Backend Foundation

Status: complete.

Scope:

- Nest.js application shell.
- Environment validation.
- Supabase service boundary.
- Health checks.
- API versioning.
- Validation, logging, throttling, and secure headers.

Exit criteria:

- Backend starts consistently.
- Required environment variables are validated.
- Protected APIs have auth/role boundaries.
- Service-role usage stays server-side.

### Phase 2: Student Read API

Status: complete for initial UI migration.

Scope:

- Student identity and profile.
- Dashboard.
- Announcements.
- Cohorts and programs.
- Resources and recordings.
- Schedule/workshops.
- Project submission visibility.
- Certificate visibility.
- Payment-order visibility.
- Support ticket visibility.

Exit criteria:

- Student routes are authenticated.
- List APIs are paginated and bounded.
- Student data is scoped to the authenticated user.
- Locked/private resources do not leak URLs.

### Phase 3: Admin Read API

Status: complete for initial UI migration.

Scope:

- Admin identity and role guard.
- Admin dashboard.
- Students.
- Enrollments.
- Payment orders.
- Paid access.
- Projects and submissions.
- Certificates and certificate requests.
- Support tickets.
- Workshops and recording candidates.

Exit criteria:

- Admin routes require active admin identity.
- List APIs are paginated and bounded.
- Admin responses avoid private provider secrets and raw webhook-sensitive payloads unless explicitly required.

### Phase 4: Critical Workflows

Status: local foundation nearly complete; live execution intentionally disabled.

Scope:

- Razorpay webhook intake and payment event processing.
- Enrollment activation and access workflows.
- Project submission and review workflows.
- Support ticket write workflows.
- Workshop/recording workflows.
- Certificate approval, generation, PDF rendering, and storage workflows.
- Email outbox, provider-send, delivery-result, and dispatch workflows.
- Background cleanup workflows.

Current rule:

- All write/provider gates remain `false`.
- No controller, scheduler, worker, provider, table write, or storage write should be enabled without a separate approval step.

Known Supabase gaps before write activation:

- Missing `certificate_generation_jobs`.
- Missing `email_outbox`.
- Missing several idempotency columns.
- Certificate storage naming mismatch: readiness expected `certificates-private`, live project has private `certificate-pdfs`.
- Email template body column names require adaptation or migration planning.

Exit criteria before any production write execution:

- Missing schema structures are resolved through an approved migration or code adaptation.
- Staging write tests pass one workflow at a time.
- Rollback plan exists for every workflow.
- Existing HTML app is checked after each shared-data test.

### Phase 5: UI Foundation And Read-Only Portal Migration

Status: next active phase.

Goal:

Rebuild the current HTML portal experience gradually as a clean Nest-backed UI while keeping the live HTML app untouched.

Recommended stack:

- `apps/web`
- React
- Vite
- TypeScript
- React Router
- TanStack Query
- Lucide icons
- CSS variables with small reusable components

Core architecture:

- API calls go through a typed client layer.
- Student and admin route groups stay separate.
- Business rules stay in domain/API layers, not inside visual components.
- Components expose loading, error, empty, locked, unauthorized, and disabled-write states explicitly.
- Write buttons may be visible only as disabled or hidden according to feature flags until backend write approval.

Recommended build order:

1. UI migration map.
2. Frontend scaffold and Skilled Sapiens-aligned visual foundation.
3. Environment config and API client.
4. Auth/session shell.
5. Protected route guards.
6. Student layout shell.
7. Admin layout shell.
8. Shared component baseline.
9. Student dashboard read-only.
10. Student LMS read modules.
11. Admin dashboard read-only.
12. Admin queue/list read modules.
13. Read-only smoke path against Nest local API.

The Phase 5 route and screen mapping is tracked in `docs/PHASE_5_UI_MIGRATION_MAP.md`.

Initial read-only screens:

- Student dashboard.
- Student community.
- Student cohorts/programs.
- Student resources.
- Student recordings.
- Student schedule/workshops.
- Student certificates.
- Student payment orders.
- Student support tickets list/detail.
- Admin dashboard.
- Admin community.
- Admin students.
- Admin enrollments.
- Admin payment orders.
- Admin paid access.
- Admin projects/submissions.
- Admin certificates/requests.
- Admin support tickets.
- Admin workshops/recording candidates.

Exit criteria:

- UI can run locally against Nest API.
- Authenticated student/admin shells work.
- Read-only screens handle loading, empty, error, unauthorized, and locked states.
- No write action mutates Supabase.
- No direct browser service-role or write path exists.
- Manual UI smoke test is documented.

### Phase 6: Controlled Write Enablement

Status: pending.

Goal:

Enable write workflows one by one after the UI/read-side experience is stable.

Recommended order:

1. Razorpay webhook persistence.
2. Payment order transition.
3. Enrollment activation.
4. Project submission.
5. Project review.
6. Support ticket create/reply/status.
7. Certificate request approval.
8. Certificate generation/PDF storage.
9. Email outbox and provider dispatch.
10. Workshop/recording write workflows.
11. Operational cleanup.

Rules:

- One workflow per approval.
- One gate or minimum gate set enabled at a time.
- Run against controlled staging/test data first.
- Disable gate immediately after test.
- Verify expected rows, audit records, read-side behavior, and live HTML app impact.
- Document each result before moving to the next workflow.

Certificate module security requirements before enabling download/generation:

- Certificate download/generation must be implemented only through Nest-controlled endpoints, never direct browser storage paths.
- Private PDF storage paths, bucket internals, student email, and service-role details must never be returned to the UI.
- Downloads must use short-lived signed URLs or streamed Nest responses after ownership/admin authorization checks.
- Generation/regeneration must require explicit role checks, idempotency, rate limits, and audit logs.
- Any Supabase storage bucket, policy, migration, object write, or generation-gate change requires explicit user approval before execution.

Exit criteria:

- All required write workflows pass controlled tests.
- Idempotency is proven.
- Audit trail is present.
- Rollback/cleanup instructions are documented.

### Phase 7: Hardening For 1000+ Concurrent Active Members

Status: pending.

Scope:

- Load testing.
- Rate-limit tuning.
- Query/index review.
- Cache strategy.
- Observability.
- Worker/queue strategy.
- Error budgets and alerting.
- Security review.
- RLS review.
- Storage signed URL review.

Exit criteria:

- Load test validates 1000+ concurrent active members.
- P95 route latency targets are defined and met.
- Database CPU, connections, slow queries, and error rates stay within safe limits.
- Background jobs recover from bursts.
- Logs, metrics, traces, and alerts are production-ready.

### Phase 8: Beta, Cutover, And Retirement

Status: pending.

Scope:

- Internal beta.
- Limited student/admin beta.
- Parallel observation with current HTML app.
- Cutover checklist.
- Rollback plan.
- Legacy HTML app retirement plan after approval.

Rules:

- Do not retire the HTML app until the Nest UI has passed production observation.
- Do not remove current production dependencies until rollback risk is acceptable.
- Keep a clear cutover date, rollback window, and owner checklist.

Exit criteria:

- New Nest UI is stable in production.
- Current HTML app is no longer required for active portal operations.
- Legacy retirement is approved and documented.

## Development Step Checklist

Before starting any step:

- Confirm the active phase.
- Confirm whether the step is read-only or write-capable.
- Check whether Supabase approval is required.
- Check whether the live HTML app can be affected.
- Confirm the expected files/modules to touch.

During implementation:

- Keep changes scoped.
- Follow existing patterns.
- Avoid duplicate business logic.
- Keep components and services small.
- Prefer typed contracts over ad hoc objects.
- Add focused tests for risky logic.

Before calling a step done:

- Run relevant QA.
- Update docs/checkpoints.
- Confirm no Google Sheet/App Script/fallback/legacy runtime references.
- Confirm write gates remain disabled unless explicitly approved.
- State whether Supabase was changed.

## Standard QA Gates

Backend/local foundation:

```bash
npm run audit:phase4-gates
npm run typecheck
npm run lint
npm run build
```

Use `npm test` for backend behavior changes and workflow changes.

Frontend foundation, once added:

```bash
npm run web:typecheck
npm run web:lint
npm run web:build
```

Visual/UI work must include a browser smoke test across desktop and mobile viewports before being considered complete.

## Supabase Approval Boundary

Does not require write approval:

- Read-only project metadata.
- Read-only function listing.
- Read-only schema/table/index/RPC/storage inspection.
- Read-only local API smoke tests.

Requires explicit approval:

- Migrations.
- `supabase db push`.
- Data inserts/updates/deletes.
- RLS policy changes.
- Storage bucket creation, deletion, policy changes, or object writes.
- Edge Function deploys/deletes.
- Secret changes.
- Enabling any Nest write/provider gate.
- Any test that mutates shared Supabase data.

## UI Migration Principles

- Rebuild behavior cleanly; do not copy legacy HTML code blindly.
- Match important workflows before visual polish.
- Keep dashboard pages information-dense and operational, not marketing-like.
- Avoid oversized hero sections in portal views.
- Use clear navigation and route grouping for repeated daily use.
- Keep write actions visibly controlled by feature flags.
- Every list must support pagination or bounded loading.
- Every screen must have loading, empty, error, and unauthorized states.

## Decision Rule

When unsure, choose the path that keeps:

- The live HTML app safe.
- Supabase unchanged unless approved.
- Code easier to audit later.
- UI migration incremental and reversible.
- Production stability/security ahead of feature volume.

## Current Phase 5 Checkpoint

- Student read-only UI is complete except Community, which remains blocked until a local Nest community contract exists.
- Admin read-only UI is complete except Community, which remains blocked until a local Nest community contract exists.
- Admin support queue/detail screens are now migrated against the bounded Nest support endpoints.
- Phase 5 must move next into smoke testing, visual QA, and authenticated staging verification before any write enablement.

## Phase 5B UI/UX Alignment Checkpoint

- UI/UX quality is now a formal gate before additional feature expansion.
- Skilled Sapiens portal styling is the benchmark: bold typography, yellow/red/white accents, pill navigation, tiles/cards, clear table layouts, and polished CTAs.
- Login is password-only in the customer-facing app. Do not add alternate login methods without explicit approval.
- Developer-facing migration wording should be removed from normal user screens during the UI pass.
- Every polished screen must be checked for desktop/mobile spacing, text wrapping, CTA alignment, and overflow.
- Page-level Phase 5B decisions, completed UI cleanups, and deferred write-work notes are tracked in `docs/PHASE_5B_UI_UX_CHECKPOINT.md`.
