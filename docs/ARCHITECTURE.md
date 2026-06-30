# Architecture

## Core Principle

Supabase is the only source of truth. Nest.js is the only application backend.

There is no Google Sheet, Apps Script, or legacy fallback dependency in this platform.

## Runtime

```txt
Browser or mobile client
  -> Nest.js API
    -> Supabase Auth
    -> Supabase Postgres
    -> Supabase Storage
    -> Queue workers
    -> Email providers
```

## Scale Design

The application is designed for 1000+ concurrent active members by default:

- Short request paths.
- Bounded dashboard payloads.
- Pagination on every list endpoint.
- Indexed database access patterns.
- Background workers for PDF, email, cleanup, and imports.
- CDN-backed static and downloadable assets.
- Rate limits on public and authenticated endpoints.
- Health and metrics endpoints for production monitoring.

## Security Design

- Supabase JWT verification on protected routes.
- Server-side role checks for admin operations.
- Service-role key is server-only.
- DTO validation strips unknown fields.
- Private files use signed URLs.
- Audit logs are written for sensitive operations.
- Logs redact authorization headers and cookies.

## Module Boundary

- `AdminsService` owns admin identity and dashboard summary behavior.
- `AdminStudentsService` owns admin student-list reads.
- `AdminCohortsService` owns admin cohort-list reads.
- `AdminProgramsService` owns admin program-list reads.
- `AdminResourcesService` owns admin resource-list reads.
- Future admin list domains should get their own focused services instead of expanding `AdminsService` into a catch-all.
