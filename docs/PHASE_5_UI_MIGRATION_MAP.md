# Phase 5 UI Migration Map

Date: 2026-06-27

## Purpose

This document maps the current HTML portal experience into the new Nest-backed UI build sequence.

Phase 5 starts with read-only portal migration. Write actions stay disabled until Phase 6 controlled write enablement.

## Guardrails

- Current HTML app remains live.
- New UI must call Nest API endpoints, not Supabase directly for LMS data.
- No Google Sheet, Apps Script, fallback, retired, or legacy runtime logic.
- No browser-side service-role key.
- No Supabase writes from Phase 5 UI.
- All write-capable actions are hidden or disabled behind feature flags.
- Every list screen must use bounded pagination.
- Every screen must define loading, empty, error, unauthorized, and locked/disabled states.

## Frontend Foundation

Recommended location:

- `apps/web`

Recommended stack:

- React
- Vite
- TypeScript
- React Router
- TanStack Query
- Lucide icons
- CSS variables and small reusable components

Core modules to create first:

- App bootstrap.
- Environment config.
- API client.
- Auth/session provider.
- Query client provider.
- Protected route guard.
- Student layout.
- Admin layout.
- Shared shell/navigation components.
- Reusable table/list/card/empty/error/loading components.
- Feature flag registry for disabled write actions.
- Skilled Sapiens brand-aligned portal tokens.

## Route Groups

### Public/Auth

| New route | Purpose | Nest API dependency | Mode | Risk | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| `/login` | Supabase login entry shell | Supabase Auth client only for session; LMS data through Nest after login | Auth | Medium | User can enter token/session path without exposing service-role or LMS writes. |
| `/auth/callback` | Auth callback/session settling | Supabase Auth session | Auth | Medium | Session is stored client-side using anon-safe Supabase Auth only. |
| `/unauthorized` | Role/access error | None | Static | Low | Clear role/access failure without leaking internals. |

### Student Portal

| New route | Current portal area | Nest API dependency | Mode | Risk | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| `/student` | Student dashboard | `GET /api/v1/students/me`, `GET /api/v1/students/me/dashboard` | Read-only | Medium | Shows student identity, dashboard summary, and safe empty/error/loading states. |
| `/student/announcements` | Announcements | `GET /api/v1/students/me/announcements` | Read-only | Low | Paginated list supports priority/search filters. |
| `/student/community` | Community | `GET /api/v1/students/me/community` | Read-only | Medium | Shows allowed community activity only. Posting, commenting, reactions, uploads, and joins are disabled. |
| `/student/cohorts` | Cohorts/program access | `GET /api/v1/students/me/cohorts` | Read-only | Low | Shows visible cohorts only. |
| `/student/resources` | Resource library | `GET /api/v1/students/me/resources` | Read-only | Medium | Locked paid resources do not expose URLs. |
| `/student/recordings` | Recordings | `GET /api/v1/students/me/recordings` | Read-only | Medium | Locked recordings do not expose URLs. |
| `/student/schedule` | Workshops/schedule | `GET /api/v1/students/me/schedule` | Read-only | Medium | Locked workshops do not expose join links. |
| `/student/projects` | Live projects | `GET /api/v1/students/me/projects` | Read-only | Medium | Project tasks/documents/deliverables render safely. Submit action disabled. |
| `/student/project-submissions` | Submission history | `GET /api/v1/students/me/project-submissions` | Read-only | Medium | Submission history is visible; new submission action disabled. |
| `/student/certificates` | Certificates | `GET /api/v1/students/me/certificates` | Read-only | Medium | No private PDF storage fields are exposed. |
| `/student/payments` | Payment orders | `GET /api/v1/students/me/payment-orders` | Read-only | Medium | Shows payment/order status without signature material. Payment actions disabled. |
| `/student/access` | Paid access | `GET /api/v1/students/me/paid-access` | Read-only | Medium | Shows active/expired grants using `activeNow`. |
| `/student/support` | Support ticket list | `GET /api/v1/students/me/support-tickets` | Read-only | Medium | Shows owned tickets only. Create ticket action disabled. |
| `/student/support/:ticketId` | Support ticket detail | `GET /api/v1/students/me/support-tickets/:ticketId` | Read-only | Medium | Shows public thread only. Reply action disabled. |

### Admin Portal

| New route | Current portal area | Nest API dependency | Mode | Risk | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| `/admin` | Admin dashboard | `GET /api/v1/admins/me`, `GET /api/v1/admins/dashboard` | Read-only | Medium | Shows active admin identity and overview without write actions. |
| `/admin/announcements` | Announcement admin | `GET /api/v1/admins/announcements` | Read-only | Medium | List is paginated; create/edit actions disabled. |
| `/admin/community` | Community moderation | `GET /api/v1/admins/community` | Read-only | High | Shows bounded moderation/activity view. Moderation, posting, deletion, and member actions are disabled. |
| `/admin/students` | Student management | `GET /api/v1/admins/students` | Read-only | Medium | Paginated student list with status/search. |
| `/admin/cohorts` | Cohort management | `GET /api/v1/admins/cohorts` | Read-only | Medium | Paginated cohort list; writes disabled. |
| `/admin/programs` | Program catalog | `GET /api/v1/admins/programs` | Read-only | Medium | Paginated program list; writes disabled. |
| `/admin/projects` | Project catalog | `GET /api/v1/admins/projects`, `GET /api/v1/admins/project-roles` | Read-only | Medium | Catalog renders parsed project metadata; writes disabled. |
| `/admin/project-submissions` | Project review queue | `GET /api/v1/admins/project-submissions` | Read-only | High | Queue renders status/repeat annotations; approve/reject disabled. |
| `/admin/resources` | Resource admin | `GET /api/v1/admins/resources` | Read-only | Medium | Resource list renders without storage internals. |
| `/admin/workshops` | Workshop management | `GET /api/v1/admins/workshops` | Read-only | High | Start URLs and provider internals stay hidden. Write actions disabled. |
| `/admin/recording-candidates` | Recording candidate review | `GET /api/v1/admins/recording-candidates` | Read-only | High | Candidate review actions disabled. |
| `/admin/certificates` | Certificate registry | `GET /api/v1/admins/certificates` | Read-only | Medium | Private storage internals stay hidden. |
| `/admin/certificate-requests` | Certificate request queue | `GET /api/v1/admins/certificate-requests` | Read-only | High | Approval/rejection actions disabled. |
| `/admin/enrollments` | Enrollment queue | `GET /api/v1/admins/enrollment-requests` | Read-only | High | Queue excludes raw payload blobs; activation actions disabled. |
| `/admin/enrollments/:requestId` | Enrollment detail | `GET /api/v1/admins/enrollment-requests/:requestId` | Read-only | High | Shows bounded items/history without raw payload detail blobs. |
| `/admin/enrollment-exceptions` | Enrollment exceptions | `GET /api/v1/admins/enrollment-exceptions` | Read-only | High | Exception resolution actions disabled. |
| `/admin/webhook-events` | Webhook event monitor | `GET /api/v1/admins/enrollment-webhook-events` | Read-only | High | Raw webhook payloads stay hidden. |
| `/admin/payment-orders` | Payment orders | `GET /api/v1/admins/payment-orders` | Read-only | High | Signature material stays hidden. |
| `/admin/paid-access` | Paid-access grants | `GET /api/v1/admins/paid-access` | Read-only | High | Grant/revoke actions disabled. |
| `/admin/support` | Support queue | `GET /api/v1/admins/support-tickets` | Read-only | High | Ticket body omitted in list; status/reply actions disabled. |
| `/admin/support/:ticketId` | Support detail | `GET /api/v1/admins/support-tickets/:ticketId` | Read-only | High | Message thread capped; reply/status/internal note actions disabled. |

## Build Order

### Step 1: UI Scaffold

Deliverables:

- `apps/web` Vite app.
- TypeScript config.
- Shared scripts.
- Base app shell.
- Basic routing.
- Initial visual foundation with portal color tokens, responsive shell styling, status badges, metric tiles, and read-only dashboard preview panels.
- Student/admin Community navigation added as a read-only Phase 5 module.

Exit criteria:

- App builds.
- App runs locally.
- No LMS data calls yet.
- The first screen looks like a deliberate LMS operations portal, not an unstyled wireframe.

Status: scaffold and initial visual foundation created.

Initial routes:

- `/login`
- `/unauthorized`
- `/student`
- `/student/:moduleId`
- `/admin`
- `/admin/:moduleId`

Community routes included in the generic module route:

- `/student/community`
- `/admin/community`

### Step 2: API And Auth Foundation

Deliverables:

- API client with bearer-token injection.
- Query client.
- Session provider.
- Protected route guards.
- Student/admin role detection through `/students/me` and `/admins/me`.
- Auth callback route.
- Email-link sign-in shell using Supabase Auth anon configuration only.
- Safe missing-configuration state for local development.

Exit criteria:

- Authenticated API calls work against Nest local API.
- Unauthorized state is handled cleanly.
- No browser-side service-role key or Supabase write path exists.

Status: local foundation created.

Implemented routes/components:

- `/login`
- `/auth/callback`
- Student protected shell through `GET /api/v1/students/me`.
- Admin protected shell through `GET /api/v1/admins/me`.

### Step 3: Layout And Component Baseline

Deliverables:

- Student shell.
- Admin shell.
- Navigation.
- Page header.
- Stat tiles.
- Portal visual tokens.
- Data table/list shell.
- Filter bar.
- Empty state.
- Error state.
- Loading state.
- Disabled-action affordance.
- Locked-content state.

Exit criteria:

- Desktop/mobile shells render without overlap.
- Reusable components are small and documented by usage.

Status: local component baseline created.

Implemented components:

- `PageHeader`
- `ActionButton`
- `FilterBar`
- `DataPanel`
- `LoadingState`
- `EmptyState`
- `ErrorState`
- `LockedState`
- `DisabledWriteAction`

The generic module placeholder now uses this baseline so future student/admin screens start from the same visual and state model.

### Step 4: Student Read-Only Screens

Deliverables:

- Dashboard.
- Announcements.
- Community.
- Cohorts.
- Resources.
- Recordings.
- Schedule.
- Projects.
- Project submissions.
- Certificates.
- Payments.
- Paid access.
- Support list/detail.

Exit criteria:

- All student screens consume Nest APIs.
- Pagination/filtering is wired where supported.
- Locked content remains locked.
- Write actions are disabled or hidden.

Status: started.

Implemented:

- `/student` now renders the real Student Dashboard screen.
- `GET /api/v1/students/me` is consumed through a typed frontend hook.
- `GET /api/v1/students/me/dashboard` is consumed through a typed frontend hook.
- The dashboard renders learner profile, program/cohort context, summary counts, read-only module overview, empty/error/loading/locked states, and disabled-write guidance.
- `/student/announcements` now renders a real read-only list screen.
- `GET /api/v1/students/me/announcements` is consumed through a typed frontend hook.
- Announcements support URL-backed search, priority filtering, bounded pagination, pinned/priority badges, loading/error/empty states, and read-only migration guidance.
- `/student/cohorts` now renders a real read-only list screen.
- `GET /api/v1/students/me/cohorts` is consumed through a typed frontend hook.
- Cohorts support URL-backed search, status filtering, bounded pagination, safe group-link display, loading/error/empty states, and read-only migration guidance.
- `/student/resources` now renders a real read-only list screen.
- `GET /api/v1/students/me/resources` is consumed through a typed frontend hook.
- Resources support URL-backed search, access-type/resource-type filters, bounded pagination, locked-content handling, safe resource links only when unlocked, loading/error/empty states, and read-only migration guidance.
- `/student/recordings` now renders a real read-only list screen.
- `GET /api/v1/students/me/recordings` is consumed through a typed frontend hook.
- Recordings support URL-backed search, access/source filters, bounded pagination, locked-content handling, safe playback links only when unlocked, loading/error/empty states, and read-only migration guidance.
- `/student/schedule` now renders a real read-only list screen.
- `GET /api/v1/students/me/schedule` is consumed through a typed frontend hook.
- Schedule supports URL-backed search, access/status filters, bounded pagination, locked-content handling, safe join links only when unlocked, loading/error/empty states, and read-only migration guidance.
- `/student/projects` now renders a real read-only list screen.
- `GET /api/v1/students/me/projects` is consumed through a typed frontend hook.
- Projects support URL-backed search, program/role filters, bounded pagination, parsed tasks/documents/deliverables, safe document links, loading/error/empty states, and read-only submission guidance.
- `/student/project-submissions` now renders a real read-only list screen.
- `GET /api/v1/students/me/project-submissions` is consumed through a typed frontend hook.
- Project submissions support URL-backed search, status/program/cohort filters, bounded pagination, attempt/repeat indicators, safe submission references, loading/error/empty states, and read-only workflow guidance.
- `/student/certificates` now renders a real read-only list screen.
- `GET /api/v1/students/me/certificates` is consumed through a typed frontend hook.
- Certificates support URL-backed search, status/generation/type filters, bounded pagination, certificate metadata display, and no private PDF storage or generation controls.
- `/student/payments` now renders a real read-only list screen.
- `GET /api/v1/students/me/payment-orders` is consumed through a typed frontend hook.
- Payments support URL-backed search, status/item-type filters, bounded pagination, order/reference display, and no payment initiation, verification, refund, or signature workflow exposure.
- `/student/access` now renders a real read-only list screen.
- `GET /api/v1/students/me/paid-access` is consumed through a typed frontend hook.
- Paid access supports URL-backed search, status/item-type filters, bounded pagination, active-now/expiry visibility, and no grant, revoke, expiry adjustment, or reconciliation workflow exposure.
- `/student/support` now renders a real read-only list screen.
- `GET /api/v1/students/me/support-tickets` is consumed through a typed frontend hook.
- `/student/support/:ticketId` now renders a real read-only ticket detail screen.
- `GET /api/v1/students/me/support-tickets/:ticketId` is consumed through a typed frontend hook.
- Support screens show owned tickets and public message threads only. Create, reply, attachment, escalation, status update, and internal-note workflows are not exposed.

Blocked pending read-only backend contract:

- `/student/community` remains placeholder-backed because no local Nest student community endpoint, DTO, service, or community schema contract exists yet. Do not build this UI against guessed tables.

Remaining student read-only screens:

- Community.

Optimization note:

- Route-level code splitting is active for page modules. The previous Vite chunk-size warning is resolved.

### Step 5: Admin Read-Only Screens

Deliverables:

- Dashboard.
- Announcements.
- Community.
- Students.
- Cohorts/programs.
- Projects/project roles.
- Project submissions.
- Resources.
- Workshops.
- Recording candidates.
- Certificates/certificate requests.
- Enrollments/exceptions/webhook events.
- Payment orders/paid access.
- Support list/detail.

Exit criteria:

- All admin screens consume Nest APIs.
- Tables are paginated and bounded.
- Sensitive internals remain hidden.
- Write actions are disabled or hidden.

Status: started.

Implemented:

- `/admin` now renders the real Admin Dashboard screen.
- `GET /api/v1/admins/me` is consumed through a typed frontend hook.
- `GET /api/v1/admins/dashboard` is consumed through a typed frontend hook.
- The dashboard renders admin profile, defensive operational summary counts, read-only module guidance, loading/error/empty states, and disabled-write guidance.
- `/admin/announcements` now renders a real read-only list screen.
- `GET /api/v1/admins/announcements` is consumed through a typed frontend hook.
- Announcements support URL-backed search, status/priority/audience filters, bounded pagination, safe audience targeting display, and no create/edit/publish/pin/delete controls.
- `/admin/students` now renders a real read-only list screen.
- `GET /api/v1/admins/students` is consumed through a typed frontend hook.
- Students support URL-backed search, active/inactive filters, bounded pagination, assignment/track-role display, and no profile edit, activation, enrollment, or access controls.
- `/admin/cohorts` now renders a real read-only list screen.
- `GET /api/v1/admins/cohorts` is consumed through a typed frontend hook.
- Cohorts support URL-backed search, status filters, bounded pagination, student-count/self-paced visibility, and no creation, editing, assignment, group-link, or status controls.
- `/admin/programs` now renders a real read-only list screen.
- `GET /api/v1/admins/programs` is consumed through a typed frontend hook.
- Programs support URL-backed search, active/inactive filters, bounded pagination, domain/status visibility, and no creation, editing, activation, or catalog publishing controls.
- `/admin/projects` now renders a real read-only project and project-role catalog screen.
- `GET /api/v1/admins/projects` is consumed through a typed frontend hook.
- `GET /api/v1/admins/project-roles` is consumed through a typed frontend hook.
- Projects and project roles support URL-backed view/search/status/program/role filters, bounded pagination, parsed tasks/documents/deliverables, safe external document links, tab-scoped data fetching, and no creation, editing, role mapping, file, status, or submission controls.
- `/admin/project-submissions` now renders a real read-only review queue screen.
- `GET /api/v1/admins/project-submissions` is consumed through a typed frontend hook.
- Project submissions support URL-backed search/status/program/role/cohort/submitted-date filters, bounded pagination, duplicate/repeat-attempt annotations, safe submission links, and no start-review, approve, reject, feedback, resubmission, status-change, or audit-write controls.
- `/admin/resources` now renders a real read-only resource catalog screen.
- `GET /api/v1/admins/resources` is consumed through a typed frontend hook.
- Resources support URL-backed search/status/access filters, bounded pagination, audience mapping, safe resource links, and no upload, edit, URL replacement, pricing, audience mapping, activation, deletion, or storage-write controls.
- `/admin/workshops` now renders a real read-only workshop schedule screen.
- `GET /api/v1/admins/workshops` is consumed through a typed frontend hook.
- Workshops support URL-backed search/status/access filters, bounded pagination, audience mapping, meeting labels, safe join/recording/payment links exposed by the Nest contract, and no private start URL, schedule, provider, status, recording-publication, payment-link, or audience-mapping write controls.
- `/admin/recording-candidates` now renders a real read-only recording candidate queue screen.
- `GET /api/v1/admins/recording-candidates` is consumed through a typed frontend hook.
- Recording candidates support URL-backed search/status/workshop/Zoom-account filters, bounded pagination, file metadata, review metadata, safe play/download links, and no review, reject, publish, workshop attachment, URL replacement, or deletion controls.
- `/admin/certificates` now renders a real read-only certificate registry screen.
- `GET /api/v1/admins/certificates` is consumed through a typed frontend hook.
- Certificates support URL-backed search/status/generation/type filters, bounded pagination, safe certificate metadata, and no private PDF storage path, generation, download, revoke, reissue, or manual status controls.
- `/admin/certificate-requests` now renders a real read-only certificate request queue screen.
- `GET /api/v1/admins/certificate-requests` is consumed through a typed frontend hook.
- Certificate requests support URL-backed search/moderator-status/admin-status filters, bounded pagination, review metadata, and no submission token, private note, approval, rejection, issuance, generation-job, or PDF workflow controls.
- `/admin/enrollments` now renders a real read-only enrollment request queue screen.
- `GET /api/v1/admins/enrollment-requests` is consumed through a typed frontend hook.
- Enrollment requests support URL-backed search/payment-status/request-type/career-level/personal-mentor filters, bounded pagination, payment and activation metadata, exception counts, and no activation, rejection, cohort assignment, payment reconciliation, duplicate handling, or exception resolution controls.
- `/admin/enrollments/:requestId` now renders a real read-only enrollment request detail screen.
- `GET /api/v1/admins/enrollment-requests/:requestId` is consumed through a typed frontend hook.
- Enrollment detail shows bounded request items and bounded status history without raw payload blobs or status-write controls.
- `/admin/enrollment-exceptions` now renders a real read-only enrollment exception queue screen.
- `GET /api/v1/admins/enrollment-exceptions` is consumed through a typed frontend hook.
- Enrollment exceptions support URL-backed search/status/exception-type filters, bounded pagination, safe exception metadata, and no raw payload inspection, mapping edit, approval, rejection, resolution, or activation controls.
- `/admin/webhook-events` now renders a real read-only enrollment webhook event monitor.
- `GET /api/v1/admins/enrollment-webhook-events` is consumed through a typed frontend hook.
- Webhook events support URL-backed search/status filters, bounded pagination, sanitized processing metadata, and no raw payload, signature, replay, retry, manual processing, or status mutation controls.
- `/admin/payment-orders` now renders a real read-only payment order screen.
- `GET /api/v1/admins/payment-orders` is consumed through a typed frontend hook.
- Payment orders support URL-backed search/status/item-type filters, bounded pagination, operational Razorpay order/payment references, and no signature material, verification, refund, reconciliation, or manual status controls.
- `/admin/paid-access` now renders a real read-only paid access grant screen.
- `GET /api/v1/admins/paid-access` is consumed through a typed frontend hook.
- Paid access supports URL-backed search/status/item-type filters, bounded pagination, active-now visibility, source/payment/expiry metadata, and no grant, revoke, expiry adjustment, entitlement repair, reconciliation, or manual status controls.
- `/admin/support` now renders a real read-only support queue screen.
- `GET /api/v1/admins/support-tickets` is consumed through a typed frontend hook.
- `/admin/support/:ticketId` now renders a real read-only support ticket detail screen.
- `GET /api/v1/admins/support-tickets/:ticketId` is consumed through a typed frontend hook.
- Support screens support URL-backed search/status/priority/category filters, bounded pagination, ticket metadata, capped message threads, public/internal visibility labels, and no reply, assignment, escalation, internal-note, attachment, status-transition, close, or reopen controls.

Blocked pending read-only backend contract:

- `/admin/community` remains placeholder-backed because no local Nest admin community endpoint, DTO, service, or community schema contract exists yet. Do not build this UI against guessed tables.

Remaining admin read-only screens:

- Community.

### Step 6: Phase 5 Smoke Test

Deliverables:

- Local frontend smoke test checklist.
- Desktop/mobile browser pass.
- Read-only API smoke path.

Exit criteria:

- Student/admin navigation works.
- Key screens load with real authenticated tokens.
- No Supabase mutation occurs.
- No current HTML app behavior is affected.

## Write Actions Deferred To Phase 6

The following UI actions are not allowed to mutate data during Phase 5:

- Student project submission.
- Student support ticket creation.
- Student support reply.
- Community post/comment/reaction/upload/member mutation.
- Payment initiation or payment mutation.
- Admin enrollment activation.
- Admin project review.
- Admin certificate approval/rejection.
- Admin support reply/status/internal note.
- Admin workshop status change.
- Recording candidate approval/publish.
- Email send/dispatch.
- Certificate PDF generation.

Certificate download/generation follow-up:

- When this module is enabled later, implement it only through Nest-controlled endpoints with ownership/admin authorization.
- Do not expose private PDF storage paths, bucket internals, student email, or service-role details to the browser.
- Use short-lived signed URLs or Nest-streamed responses, plus rate limits, idempotency, and audit logs.
- Ask for explicit approval before any Supabase storage, policy, migration, object write, or generation-gate change.

## Phase 5 Done Definition

Phase 5 is complete when:

- The frontend shell exists and builds.
- Student and admin authenticated layouts are working.
- Read-only student screens are migrated.
- Read-only admin screens are migrated.
- Disabled write actions are visibly controlled.
- Browser smoke testing passes on desktop and mobile.
- No Supabase write was performed by the UI.
- The current HTML app remains live and unaffected.
