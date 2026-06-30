# Phase 4 Supabase Read-Only Audit

Date: 2026-06-27

## Scope

This checkpoint records the first Supabase-related operation for the Nest.js migration.

Only read-only Supabase CLI discovery was performed:

- Project listing.
- Edge Function listing.
- CLI capability/help checks.

No Supabase writes were performed.
No migrations were run.
No schema changes were made.
No storage changes were made.
No secrets were changed.
No write gates were enabled.
No local Supabase project link was created during the first discovery checkpoint.

## Project Discovered

- Project name: `Skilledsapiens-LMS`
- Project ref: `olgihgkyteumndphxsut`
- Region: `ap-southeast-1`
- Status: `ACTIVE_HEALTHY`
- Postgres version: `17.6.1.127`
- Postgres engine: `17`
- Nest.js repo linked to project: `false`
- Supabase CLI version used locally: `2.106.0`

## Active Edge Functions Observed

The following active Edge Functions currently exist in the live Supabase project:

| Function | JWT Verification |
| --- | --- |
| `razorpay-enrollment-webhook` | `false` |
| `support-ticket-email` | `true` |
| `support-attachment-cleanup` | `false` |
| `zoom-meetings` | `true` |
| `transactional-email` | `true` |
| `email-campaigns` | `true` |
| `student-payments` | `true` |
| `certificate-issuance` | `true` |
| `certificate-pdf-cleanup` | `false` |
| `brevo-webhook` | `false` |
| `student-auth-bridge` | `true` |
| `admin-auth-bridge` | `true` |
| `project-submissions` | `true` |

Functions with `verify_jwt=false` may be valid for webhook or scheduled-secret entry points, but each one must be reviewed for signature/shared-secret validation before production cutover.

## Current Boundary

The Nest.js repo currently has only `.env.example`; no local `.env` credentials are present.

Schema/index/table verification is still pending because the CLI requires one of these approval-controlled paths:

1. Link this local repo to project `olgihgkyteumndphxsut`.
2. Provide/use a database URL for read-only inspection commands.

Either path is read-capable but more sensitive than project/function listing. It should be approved separately before use.

## UI Timing

UI development can start after the read-only schema contract is verified enough to confirm that the current Nest.js read APIs match the live Supabase data model.

Recommended order:

1. Complete schema/index/table read-only verification.
2. Freeze the current read API contract for student/admin UI screens.
3. Start UI shell, authentication screens, student dashboard, and admin dashboard.
4. Keep Phase 4 write workflows disabled while UI work begins.
5. Add write interactions later workflow-by-workflow after staging write approvals.

This lets the LMS UI move forward without waiting for every write workflow to be live.

## Next Approval-Controlled Step

Recommended next step:

Run read-only schema/index verification for required Phase 4 tables, columns, unique constraints, indexes, storage buckets, and RLS-sensitive surfaces.

No migration or data mutation should be run during that step.

Follow-up schema audit result: `docs/PHASE_4_SUPABASE_SCHEMA_AUDIT_20260627.md`.
