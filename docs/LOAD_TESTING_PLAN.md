# Load Testing Plan

## Target

Validate stable behavior for 1000+ concurrent active members.

## Scenarios

1. Login and token validation.
2. Student dashboard load.
3. Course/resources browsing.
4. Project submission.
5. Certificate list and verification.
6. Admin paginated list views.
7. Support and notification read/write workflows.

## Acceptance Gates

- No unbounded database queries.
- No endpoint depends on certificate PDF generation or email sending inline.
- P95 latency targets are defined per route before UAT.
- Error rate remains below the agreed production threshold.
- Database CPU, connection pool, and slow query logs stay within safe limits.
- Background job queues recover after bursts.

## Production Readiness Checks

- Index review for all filters and sort keys.
- Pagination enforced on all list APIs.
- Rate limits verified.
- Supabase storage signed URL flow verified.
- Audit logs verified for sensitive actions.
