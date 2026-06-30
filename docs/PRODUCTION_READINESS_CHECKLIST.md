# Production Readiness Checklist

## Stability

- Load test validates 1000+ concurrent active members.
- Dashboard APIs use bounded queries.
- Every list endpoint has pagination and maximum page size.
- Admin student listing enforces bounded pagination before production expansion to other admin lists.
- Slow jobs run in workers, not HTTP request handlers.
- Database indexes match production filters and sort keys.
- Health checks are wired to deployment monitoring.

## Security

- Supabase JWT verification is enforced on protected routes.
- Admin routes enforce server-side role checks.
- Service-role key never reaches the browser.
- CORS is limited to approved domains.
- Rate limits are enabled.
- Private storage access uses signed URLs.
- Certificate PDF download/generation is Nest-controlled, authorization-checked, rate-limited, audited, and never exposes private storage paths to the browser.
- Audit logs cover certificates, enrollments, role changes, and auth-sensitive events.

## Operations

- Structured logs are available.
- Request IDs are propagated.
- Error rates and latency are monitored.
- Queue depth is monitored.
- Failed jobs are retryable and visible.
- Development follows `docs/DEVELOPMENT_CYCLE_GUIDE.md`.
- Phase 4 write workflows follow `docs/PHASE_4_WRITE_WORKFLOW_DESIGN.md`.
- Phase 4 Supabase write readiness follows `docs/PHASE_4_SUPABASE_WRITE_READINESS.md`.
- Deployment rollback is documented.
- Secrets are configured through the deployment platform.

## Migration

- No Google Sheet runtime dependency exists.
- No Apps Script runtime dependency exists.
- No legacy fallback code exists.
- Supabase is the only source of truth.
- Cutover has a staged beta and observation window.
