# Phase 5B UI/UX Implementation Checkpoint

Date: 2026-06-29
Status: Phase 5B UI/UX complete and QA-passed.

## Purpose

This document is the current Phase 5B UI implementation reference. It describes the active UI behavior developers should preserve and extend.

Use this document before changing LMS pages so future work keeps the compact Skilled Sapiens HTML-app experience, avoids bulky layouts, and does not enable write actions without a backend audit.

## Global UI Rules

- Match the Skilled Sapiens HTML application style: light canvas, white panels, yellow active actions/navigation, red destructive or primary alert actions, soft status pills, compact typography, and clean spacing.
- Keep operational pages compact. Avoid oversized tiles, heavyweight record titles, inflated pills, and large row heights.
- Use normal readable content weight by default: target `400-600`, not `700-900`.
- Record titles inside cards/lists should usually be `14-16px` and `500-600` weight.
- Filters must be aligned with clear spacing. Search input and Apply/CTA must be visually separate controls.
- Long IDs, emails, references, cohort/program names, payment IDs, and titles must wrap inside their container without overlap.
- Admin pages may show operational controls, but should avoid internal implementation noise.
- Student-facing pages must not mention Supabase, Nest API, migration, phase, provider internals, workflow audit, raw storage paths, or private URLs.
- Prefer workflow-specific layouts from the HTML application: clear page headings, relevant controls, compact cards/lists, and focused actions.
- Write CTAs may be visible for operational parity, but must stay disabled unless the write workflow is backend-audited, role-gated, feature-flagged where required, and explicitly approved.

## Validation Standard

For every Phase 5B page change:

- Run `npm run web:typecheck`.
- Run `npm run web:lint`.
- Run `npm run web:build`.
- Manually inspect visual layout when CSS or page structure changes.
- Confirm no unapproved write action is enabled.
- Confirm customer-facing text does not expose internal platform details.

## Phase 5B Closeout

Final QA status:

- Full UI regression pass: Passed.
- Write-action boundary review: Passed.
- Responsive/alignment QA: Passed.
- Phase 5B implementation status: UI/UX complete.

Remaining work is assigned to the next backend/write-flow audit phase. That audit should decide which visible disabled actions can be safely enabled with persistence, role checks, feature flags where required, validation, and audit logging.

## Write-Action Boundary

Enabled write actions:

- Admin Schedule Meeting Past tab `Mark Completed`, guarded by admin permissions and the workshop status write flag.
- Admin Project Submissions approve/reject, guarded by the existing reviewed submission review workflow and feature flag.
- Admin Cohorts `Save Cohort`, guarded by admin permissions and `COHORT_WRITES_ENABLED=true`, with audit logging.

Disabled pending audit:

- Student Enroll.
- Announcement send/update/status/delete.
- Resource save/remove.
- Zoom schedule/update.
- Recording URL save/update.
- Zoom recording fetch.
- Support ticket/category/settings/FAQ saves.
- Cohort edit/deactivate.
- Program create/edit/deactivate.
- Certificate issuance/PDF/revoke actions.
- Payment actions.
- Student-facing create/submit/reply/download actions where not separately approved.

## Completed UI Modules

- Admin Announcements.
- Admin Payments and Paid Access.
- Admin Resources.
- Admin Schedule Meeting / Workshops.
- Admin Recordings.
- Admin Project Submissions.
- Admin Support.
- Admin Cohorts.
- Admin Programs.
- Admin Students, including the Enroll Student modal shell.
- Student Dashboard.
- Student My Programs.
- Student Schedule.
- Student Recordings.
- Student Resources.
- Student Live Project Hub.
- Student Certificates.
- Student Announcements.
- Student Support.
- Student Payments and Paid Access.
- Student Project Submissions.

## App Shell / Navigation

Current implementation:

- Student and admin shells use a clean light layout with grouped navigation.
- Active navigation uses the yellow Skilled Sapiens treatment.
- Student main navigation order is Dashboard, My Programs, Recordings, Schedule, Resources.
- Mobile and tablet shell uses an app-like topbar with a yellow menu button and off-canvas navigation drawer.
- Drawer navigation preserves grouped sidebar structure and closes after route selection or logout.
- Shell topbar and action containers protect against overflow from long labels and badges.

Next audit:

- Continue visual QA for logged-in routes on desktop and mobile.
- Add mobile quick actions only after the drawer pattern is validated.
- Keep unfinished modules behind safe empty states or disabled controls.

## Login

Current implementation:

- Single email/password login screen.
- Branded layout aligned to the Skilled Sapiens visual style.
- No visible portal selector.
- No internal platform wording.

Next audit:

- Define password creation and forgot-password flows.
- Add branded recovery success/error states.

## Admin Dashboard

Current implementation:

- Admin dashboard presents operational summary cards and system insight sections.
- Metrics are sourced from Nest APIs.
- Published recording count is sourced from the backend published-recording count.
- No admin repair/write actions are enabled.

Next audit:

- Keep dashboard metrics backend-sourced.
- Enable refresh/repair actions only after permission and workflow review.

## Admin Students

Current implementation:

- Search, status filter, cohort filter, refresh, pagination, and row-level View are safe read actions.
- Cohort filtering is server-side through the Nest read endpoint using the student cohort name field.
- Student list includes serial number, dual flag, full name, college, email, alternate email, phone, cohorts, slot, live project domains, WhatsApp group, onboarding date, programs, status, and actions.
- View opens a Student Details modal using already-loaded row data.
- `+ Enroll Student` opens the Enroll New Student modal and writes student profile data plus selected cohort/program links behind `STUDENT_WRITES_ENABLED`.
- Enroll/Edit modal fields include student ID, full name, email, alternative email, phone, slot, WhatsApp group, college, cohorts, program name, onboarding mail status, active, and recorded password setup invite intent.
- College dropdown uses currently available student college values until a dedicated approved-colleges source exists.
- Cohorts dropdown uses configured cohorts.
- Program Name dropdown uses configured programs.
- Cohort and program selectors support multi-select with compact scrollable checkbox lists.
- Selected cohort context preview shows program, slot, WhatsApp, and Google Group details when available.
- Edit writes student profile updates behind `STUDENT_WRITES_ENABLED`.
- Deactivate and Reactivate update the student active flag behind `STUDENT_WRITES_ENABLED`.
- LP Attempts reads the current live-project attempt limit and writes reset/update changes behind `STUDENT_WRITES_ENABLED`.
- Import CSV creates new students and updates existing students by email through the gated student upsert workflow.
- Export CSV downloads the currently filtered table page only.
- Student create, edit, status, import, and LP-attempt writes record `audit_logs` entries; password setup invite stays recorded/gated with no provider email send.

Next audit:

- Add a dedicated approved-colleges read source.
- Confirm source fields for phone, alternate email, WhatsApp group, slot, onboarding mail status, and live project domains.
- Add deeper import validation feedback for row-level failures.

## Admin Cohorts

Current implementation:

- Cohorts page uses compact cohort cards.
- Search, program/domain filter, sort, refresh, pagination, and Students navigation are safe read actions.
- Program/domain filtering and sorting are handled by the Nest read endpoint before pagination.
- Cards show cohort name, status, self-paced state, date window, student count, program count, session count, domain/program tag, session/resource counts, and actions.
- `+ Add Cohort` opens the Add New Cohort modal shell.
- Program Type dropdown shows all configured program values.
- Program key auto-fills from selected Program Type.
- Self-paced mode toggle is visible.
- When self-paced mode is enabled, recording session and PDF/document resource authoring sections appear.
- Recording session authoring supports multiple local rows with title, recording URL, duration, Add Session, and Remove controls.
- PDF/document resource authoring supports multiple local rows with resource name, URL, type dropdown, Add Resource, and Remove controls.
- Resource type values are PDF, XLSX, PPTX, DOC, and LINK.
- Save Cohort writes new cohort rows when `COHORT_WRITES_ENABLED=true`; the payload includes selected program key, cohort dates/details, and self-paced recording/resource rows when enabled.
- Save Cohort writes an `audit_logs` entry after successful create.
- Edit Cohort updates cohort details, status, group metadata, dates, student count, and self-paced recording/resource rows behind `COHORT_WRITES_ENABLED`.
- Deactivate and Reactivate update cohort status behind `COHORT_WRITES_ENABLED`.
- Create, edit, deactivate, and reactivate/status updates write `audit_logs` entries with previous/next cohort state.
- Preview remains disabled pending a confirmed preview read contract.
- Students action links to Admin Students with the cohort filter applied.

Next audit:

- Audit self-paced student visibility and downstream read contracts.
- Add real preview behavior only after the preview read contract is confirmed.

## Admin Programs

Current implementation:

- Admin Programs shows summary metrics, status filters, program records, and pagination.
- Status filters use compact segmented controls.
- `+ Program` opens a program form shell with catalog fields.
- Program Name dropdown uses known program templates.
- Short name, program key, domain, and description cascade from selected Program Name.
- Each program row shows Edit and Deactivate actions.
- Edit opens a modal populated from the selected row.
- Save/Update and Deactivate are visible but disabled pending audit.

Next audit:

- Audit program creation, editing, deactivation, validation, conflict handling, downstream impacts, and audit logging.

## Admin Projects

Current implementation:

- Admin Projects uses a two-area workspace: Project Roles master data and Live Project Library with Project Editor.
- Project Library includes search.
- Project Role list uses compact role cards with Edit and Deactivate controls.
- `+ New Role` clears the role editor into an add-role form shell.
- Live Project Library shows compact project cards with domain and status tags.
- `+ New Project` clears the project editor into an add-project form shell.
- Project card Edit pre-fills the editor.
- Project Editor includes project title, company, role dropdown, program checkboxes, program name, brief, objectives, action items, deliverables, resources, deadline, and metadata.
- Role dropdown is populated from current project role read data.
- Save Role, Save Project, and Deactivate are visible but disabled pending audit.

Next audit:

- Audit role and project create/edit/deactivate workflows.
- Confirm parsing and storage rules for action items, resources, and deliverables.
- Add server-side filters/pagination if catalog volume requires it.

## Admin Project Submissions

Current implementation:

- Admin Submissions is a compact review queue.
- Default landing filter is Pending Approval.
- Top filters include search, status, role, program, cohort, and submitted date.
- Submission rows show project title, status, repeat attempt indicators, program/cohort tags, role, student identity, request reference, submitted date, remarks, and Review Report link.
- Approve and Reject are backend actions wired to the reviewed project-submission workflow.
- Approve transitions eligible submissions to `approved`.
- Reject requires an admin review note and transitions eligible submissions to `rejected`.
- Successful review actions invalidate admin submission and certificate queues.
- Writes are guarded by `PROJECT_SUBMISSION_REVIEW_WRITES_ENABLED=true` and active admin role checks.

Next audit:

- Confirm certificate-queue materialization for approved submissions.
- Add inline review-note UI if admins need richer rejection comments.
- Add bulk review only after permissions, audit logging, and conflict behavior are approved.

## Admin Certificates

Current implementation:

- Admin Certificates follows the certificate workflow experience.
- Leadership bulk issuance section includes program, cohort, modules covered, issue date, email toggle, eligible students, and Issue Selected Certificates.
- Leadership module configuration includes program, status, predefined modules, and Save Program Modules.
- Live project certificate requests are shown from the approved-submission queue.
- Review & Issue opens a final issuance modal using request metadata.
- Issued certificate registry includes search, certificate type, certificate status, and PDF status filters.
- Verify, PDF generation/regeneration, revoke, leadership issuance, module save, live-project final issue, and report-open controls are visible but disabled pending audit.
- Private PDF storage paths, generation calls, download URLs, revoke actions, module saves, and certificate issuance writes are not exposed.

Next audit:

- Audit leadership bulk certificate issuance.
- Audit leadership module save.
- Audit live project final issuance.
- Enable Open Report only through safe read endpoints or validated submission URLs.
- Enable PDF actions only through secure Nest endpoints or signed URLs.
- Audit revoke/reissue impact and permissions.

## Admin Announcements

Current implementation:

- Admin Announcements is an admin notification centre.
- Left panel contains the Notification Centre form.
- Notification types: General, Alert, Session, Resource, Project, and Custom.
- Audience options: All Students, Specific Cohort(s), and Specific Program.
- Specific Cohort(s) shows all-cohorts checklist with Select All and Remove All.
- Specific Program shows program checklist with Select All and Remove All.
- Form includes priority, status, start date, end date, title, message, custom emoji, pin option, Preview CTA, and disabled Send/Update CTA.
- Right panel shows live preview plus Sent Announcements history.
- Preview updates from type, title, message, audience, custom emoji, and selected cohort/program counts.
- History includes filter dropdown, compact announcement rows, Edit, status dropdown, and Delete.
- Edit populates the Notification Centre form locally.
- Status and Delete are visible but disabled pending audit.

Next audit:

- Audit create/update announcement writes.
- Audit status-change workflow.
- Audit delete/soft-delete workflow.
- Confirm admin identity, timestamp, target audience, and status-transition logging.

## Admin Resources

Current implementation:

- Admin Resources is a two-panel resource workspace.
- Left panel contains Resource Library with search, status filter, program filter, cohort filter, and compact resource cards.
- Resource cards show title, resource ID/type/mode, program/cohort chips, status chip, Edit, and disabled Remove.
- Right panel contains Resource Editor form shell with resource ID, status, title, type, mode, program key, domain key, cohort sharing, access type, currency, price, payment link, Google Drive link, description, created/updated fields, Clear, and disabled Save Resource.
- Edit populates the editor locally.
- New Resource resets the local editor with a generated resource ID.
- Cohort sharing uses active/upcoming cohort data with Select All Cohorts and Clear Cohorts.
- Program key and domain key derive from selected active/upcoming cohorts when available.

Next audit:

- Audit create/update resource writes.
- Audit remove/deactivate workflow.
- Confirm cohort/program/domain audience mapping.
- Audit paid-resource price/payment link behavior.
- Validate resource URLs before enabling writes.

## Admin Schedule Meeting / Workshops

Current implementation:

- Admin navigation label is Schedule Meeting.
- Page manages Zoom meeting scheduling, workshop lifecycle state, and recording attachment.
- KPI tiles track Total Workshops, Pending with Link, Upcoming, Past, Completed, and Pending Mark Completed.
- Left panel contains the Zoom Integration form shell with session title, date, time, duration, Zoom account, cohort tagging, agenda/notes, Clear, and disabled Schedule/Update CTA.
- Session Title supports free text and a dropdown/datalist of workshop topics.
- Workshop Topics dropdown controller is separate from the scheduling form.
- Workshop Topics controller shows the full topic list in a scrollable panel and supports local Add, Edit, Remove, and Save Topics UI behavior.
- Cohort tagging uses active/upcoming cohorts with search, Select all, Clear all, compact checkbox rows, and status labels.
- Right panel contains Attach Recording fields for workshops with `workshop_status = 'Completed'`.
- Attach Recording dropdown includes admin-completed workshops eligible for final recording links.
- Attach Recording fields include YouTube URL and alternate recording URL.
- Save/Update Recording Links CTA is visible but disabled pending audit.
- Meeting List has three phases: Upcoming, Past, and Completed.
- Upcoming shows non-completed workshops whose scheduled date/time is in the future.
- Past shows non-completed, non-cancelled, non-inactive workshops whose scheduled date/time has passed.
- Past rows show Edit, Mark Completed, Postponed, and Copy Link.
- Postponed keeps the workshop in Past for now.
- Completed shows workshops where Admin marked `public.workshops.workshop_status = 'Completed'`.
- Mark Completed calls the admin status-transition endpoint and writes `public.workshops.workshop_status = 'Completed'` when `WORKSHOP_STATUS_WRITES_ENABLED=true`.
- Completed rows include an admin-only Zoom recording candidate area with disabled Fetch Zoom Recordings.
- Edit populates the meeting form locally and preloads available recording URL values.

Next audit:

- Audit Zoom meeting creation/update.
- Audit workshop topic catalog persistence.
- Keep Mark Completed guarded by admin role and write flag.
- Audit recording URL save/update.
- Audit Zoom recording candidate fetch.
- Confirm cohort tagging writes update cohort schedules safely.

## Admin Recordings

Current implementation:

- Admin Recordings is a Recording Library tile view.
- Source data is admin-completed workshop rows with final recording links: `youtube_video_url` or `zoom_recording_url`.
- Page uses the admin workshops API with `status=Completed`, then shows meetings with a recording link.
- Program filters render across the top from active admin programs.
- All Sessions is the default filter.
- Recording tiles show preview area, Session badge, program key badge, title, date, source label, and Watch CTA.
- Raw Zoom candidates, provider metadata, and private recording internals are not shown on the main page.

Next audit:

- Wire recording URL save/update from Schedule Meeting.
- Add a separate Zoom recording candidate workflow only after provider fetch/review/publish actions are audited.
- Keep student visibility dependent on final admin-approved recording links.

## Admin Support

Current implementation:

- Admin Support is a Support workspace.
- Left panel contains Support Queue with search, status, priority, category filters, compact ticket cards, and local ticket selection.
- Right panel contains Ticket Detail with ticket identity, student/email, status/priority/category chips, attachment CTA shell, status/priority controls, assigned admin field, Save Ticket CTA, and public message history.
- Support Category Manager, Support Email Settings, FAQ Categories, and FAQ Manager are present as compact admin management shells.
- Ticket list/detail reads are live.
- Ticket status/priority/assignment/category/settings/FAQ writes are visible but disabled pending audit.

Next audit:

- Audit ticket status/priority/assignment writes.
- Audit support reply/internal-note workflow.
- Audit attachment access/opening rules.
- Audit support category/settings/FAQ create/update/archive writes.

## Admin Payments / Paid Access

Current implementation:

- Admin payment pages use compact operational list views.
- Filters use separate aligned controls with spacing.
- Search and Apply are visually separate controls.
- Row content uses normal text weight and wraps long order/payment/access references.
- Payment and paid-access write actions remain disabled unless separately audited.

Next audit:

- Audit payment verification, refund, reconciliation, receipt, and paid-access grant/revoke workflows before enabling actions.

## Student Dashboard

Current implementation:

- Dashboard metrics are scoped to the logged-in student.
- Cohort chips show verified student cohort context.
- Learning overview is concise and student-facing.
- Counts are sourced from scoped Nest APIs.

Next audit:

- Add richer progress only after real progress/attendance/completion contracts exist.
- Keep all data student-scoped.

## Student My Programs

Current implementation:

- Student-facing navigation/page label is My Programs.
- Page shows only enrolled/entitled programs and cohorts returned by the student-scoped Nest endpoint.
- Page uses program/cohort cards.
- Cards show program key/title, cohort name, status, domain, self-paced indicator, start date when available, and safe group link/name when available.
- Raw cohort IDs, learner counts, and unset dates are hidden.
- Known key mappings include `mclp` as Management Consulting, `smlp` as Sales & Marketing, and `hrlp` as HR.
- WhatsApp group links show as `Join WhatsApp group` when available.

Next audit:

- Add progress only after a real backend contract exists.
- Keep page limited to entitled programs/cohorts.

## Student Schedule

Current implementation:

- Student Schedule uses session cards.
- Session cards show safe schedule metadata.
- Join links are shown only when access is granted.
- Locked workshops do not expose join links.

Next audit:

- Add calendar grouping only after the schedule contract is confirmed.
- Add reminders/attendance actions only after write approval.

## Student Recordings

Current implementation:

- Student Recordings uses recording cards.
- Recordings are student-scoped.
- Playback links are shown only when access is granted.
- Locked recordings do not expose playback URLs.

Next audit:

- Add watch/resume progress only after a watch-history contract exists.
- Add search/filter only if usage volume requires it.

## Student Resources

Current implementation:

- Student Resources uses resource cards.
- Cards show available/locked state clearly.
- Long descriptions wrap cleanly.
- Locked resources do not expose links.

Next audit:

- Add search/filter only if needed after student testing.
- Add download/open tracking only after write/audit approval.

## Student Live Project Hub

Current implementation:

- Live Project Hub includes eligible project role dropdown.
- Project dropdown is filtered by selected role.
- Detailed project view shows key tasks, support documents, deliverables, submission history, and submit CTA where a submission link exists.

Next audit:

- Use a dedicated picker endpoint if a student can have more than 100 eligible projects.
- Audit project submission write workflow.
- Add upload/link validation, duplicate attempt rules, and status refresh behavior.

## Student Project Submissions

Current implementation:

- Student Project Submissions shows a student-facing submission history card list.
- Cards show project title, role/program/cohort context, status, attempt number, repeat-submission tag, submitted date, reference number, remarks, and safe submission link when present.
- Pagination appears only when needed by API result volume.

Next audit:

- Add submission CTA only after project submission write workflow approval.
- Add edit/retry behavior only after duplicate-attempt and resubmission rules are approved.

## Student Certificates

Current implementation:

- Student Certificates uses a clean achievements view.
- Certificate titles are subtle and compact.
- `Issued` tag uses a soft status-pill style.
- `Live Project` label appears only when certificate type requires it.
- Live project title appears only when available and relevant.
- Download, generation, regeneration, and private PDF actions are not exposed.

Next audit:

- Add Verify using safe public certificate verification.
- Add Download PDF only when generated PDF is ready and exposed through a secure endpoint or signed URL.
- Add Generate/Regenerate only after eligibility, ownership, and retry rules are approved.

## Student Announcements

Current implementation:

- Student Announcements is a clean announcement feed.
- Filters include category/type, priority, pinned-only, active/expired, and program/cohort.
- Category/type uses segmented buttons.
- Priority, pinned status, date status, and program/cohort use compact dropdown filters.
- Pinned announcements receive subtle highlighted treatment.
- Announcement cards show title, message, priority, optional type, date window, cohort/program context, and safe external link when provided.
- Pagination appears only when needed by API result volume.

Next audit:

- Add read/unread tracking only after backend contract and write approval.
- Add dismiss/archive only after write workflow approval.

## Student Support

Current implementation:

- Student Support uses the Support & Guidelines experience.
- Tabs include portal guide, program FAQs, raise query, and live project support data.
- Raise Query form shell is visible, with no ticket creation mutation wired.
- My Support Tickets uses student-scoped ticket cards and safe links to ticket detail views.
- Ticket Conversation area is present for flow continuity.

Next audit:

- Add create-ticket API/UI after write workflow approval.
- Add student reply workflow after ownership, throttling, and audit controls are approved.
- Add attachment upload only with file validation, storage policy, cleanup, private URL protection, and content safety checks.

## Student Payments / Paid Access

Current implementation:

- Student Payments and Paid Access use compact student-facing list views.
- Student Payments rows show item title, amount, status, item type, date, order/payment/receipt references, and item reference.
- Student Paid Access rows show access/item identifier, active state, item type, source, amount when recorded, grant/expiry dates, and payment reference when available.
- Filters use compact dropdowns for status and item type plus a search field with a clear Apply action.
- Long IDs, references, item names, and dates wrap inside their row.

Next audit:

- Audit Razorpay/payment workflow before adding payment actions.
- Add receipt/download actions only after secure document workflow approval.
- Add retry/pay-now only after order creation, verification, idempotency, and audit controls are approved.
