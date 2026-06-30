# Staging Smoke Test Plan

## Purpose

Verify the Nest.js API against Supabase staging data without changing Supabase.

This plan is read-only. It must not run migrations, write data, deploy functions, change secrets, or modify storage.

## Preconditions

- Nest.js `.env` is configured with staging Supabase values.
- A valid student Supabase access token is available.
- A valid admin Supabase access token is available.
- The student token maps to an active `students` row.
- The admin token maps to an active `admin_users` row.

## Start Local API

```bash
npm run start:dev
```

Expected local base URL:

```txt
http://localhost:3000
```

## Run Read-Only Smoke Test

In a separate terminal, provide tokens through environment variables:

```bash
API_BASE_URL=http://localhost:3000 \
STUDENT_ACCESS_TOKEN=... \
ADMIN_ACCESS_TOKEN=... \
npm run smoke:local
```

The script performs only authenticated `GET` requests:

- `/api/v1/health`
- `/api/v1/students/me`
- `/api/v1/students/me/dashboard`
- `/api/v1/students/me/announcements?page=1&limit=10&priority=all`
- `/api/v1/students/me/certificates?page=1&limit=10&status=all&generationStatus=all&certificateType=all`
- `/api/v1/students/me/cohorts?page=1&limit=10&status=all`
- `/api/v1/students/me/paid-access?page=1&limit=10&status=all&itemType=all`
- `/api/v1/students/me/payment-orders?page=1&limit=10&status=all&itemType=all`
- `/api/v1/students/me/projects?page=1&limit=10`
- `/api/v1/students/me/project-submissions?page=1&limit=10&status=all`
- `/api/v1/students/me/recordings?page=1&limit=10&accessType=all&source=all`
- `/api/v1/students/me/resources?page=1&limit=10&accessType=all`
- `/api/v1/students/me/schedule?page=1&limit=10&accessType=all&status=all`
- `/api/v1/students/me/support-tickets?page=1&limit=10&status=all`
- `/api/v1/admins/me`
- `/api/v1/admins/dashboard`
- `/api/v1/admins/announcements?page=1&limit=10&status=all&priority=all&audience=any`
- `/api/v1/admins/students?page=1&limit=10&status=all`
- `/api/v1/admins/cohorts?page=1&limit=10&status=all`
- `/api/v1/admins/programs?page=1&limit=10&status=all`
- `/api/v1/admins/projects?page=1&limit=10&status=all`
- `/api/v1/admins/project-roles?page=1&limit=10&status=all`
- `/api/v1/admins/resources?page=1&limit=10&status=all&accessType=all`
- `/api/v1/admins/certificates?page=1&limit=10&status=all&generationStatus=all&certificateType=all`
- `/api/v1/admins/certificate-requests?page=1&limit=10&moderatorStatus=all&adminStatus=all`
- `/api/v1/admins/enrollment-requests?page=1&limit=10&paymentStatus=all&requestType=all`
- `/api/v1/admins/enrollment-exceptions?page=1&limit=10&status=all`
- `/api/v1/admins/enrollment-webhook-events?page=1&limit=10&status=all`
- `/api/v1/admins/paid-access?page=1&limit=10&status=all&itemType=all`
- `/api/v1/admins/payment-orders?page=1&limit=10&status=all&itemType=all`
- `/api/v1/admins/project-submissions?page=1&limit=10&status=pending`
- `/api/v1/admins/recording-candidates?page=1&limit=10&status=all`
- `/api/v1/admins/support-tickets?page=1&limit=10&status=all&priority=all`
- `/api/v1/admins/workshops?page=1&limit=10&status=all&accessType=all`

Support ticket detail smoke testing requires known staging ticket UUIDs and should be run separately as read-only `GET` requests:

- `/api/v1/students/me/support-tickets/{ticketId}`
- `/api/v1/admins/support-tickets/{ticketId}`

Enrollment request detail smoke testing requires a known staging request ID and should be run separately as a read-only `GET`:

- `/api/v1/admins/enrollment-requests/{requestId}`

## Run Local Razorpay Webhook Smoke Test

This test posts only to the local Nest.js API. It does not contact Razorpay. Keep both Razorpay write gates disabled so the webhook path does not write to Supabase during smoke testing.

```bash
API_BASE_URL=http://localhost:3000 \
RAZORPAY_WEBHOOK_SECRET=local-test-secret \
RAZORPAY_WEBHOOK_PERSISTENCE_ENABLED=false \
RAZORPAY_PAYMENT_ORDER_TRANSITIONS_ENABLED=false \
npm run smoke:razorpay
```

The Nest.js API must be running with the same `RAZORPAY_WEBHOOK_SECRET` and with webhook/payment-order write gates disabled unless a separate Supabase write test has been explicitly approved.

Expected result:

```txt
ok razorpay webhook: {"received":true,...}
```

## Pass Criteria

- Health returns `status: ok`.
- Student profile returns the expected active student.
- Student dashboard returns Supabase-backed dashboard sections.
- Student announcements list returns only active audience-scoped announcements.
- Student cohorts list returns only audience-scoped visible cohorts.
- Student paid access list returns only the authenticated student's grants.
- Student payment order list returns only the authenticated student's payment orders.
- Student projects list returns only student-visible project catalog rows.
- Student recordings list returns only completed published recordings and does not expose locked recording URLs.
- Student schedule list returns only audience-scoped upcoming workshops and does not expose locked join links.
- Student support ticket list returns only the authenticated student's tickets.
- Admin profile returns the expected active admin.
- Admin dashboard returns `lms_admin_dashboard_summary` output.
- Admin announcements list returns bounded announcement rows for active admins.
- Admin enrollment request list returns bounded queue rows.
- Admin enrollment exception list returns bounded queue rows.
- Admin enrollment webhook event list returns bounded queue rows.
- Admin paid access list returns bounded entitlement grants.
- Admin recording candidates list returns bounded draft/review rows for active admins only.
- Admin workshops list returns bounded workshop/meeting rows without private Zoom start URLs.
- Local Razorpay webhook smoke test reports webhook persistence and payment-order transitions disabled unless a separate write run has been approved.
- Local Razorpay smoke test accepts a valid synthetic signature.
- No Supabase writes occur.

## Stop Criteria

Stop and investigate before moving forward if:

- Any endpoint returns `401`, `403`, or `5xx`.
- The resolved student/admin identity does not match the provided token.
- Dashboard RPCs return unexpected authorization errors.
- Any test requires a Supabase schema/data change.
