# LMS Supabase Platform

Clean Supabase rebuild of the LMS with Supabase as the only source of truth.

## Goal

Build a secure, stable LMS portal for 1000+ concurrent active members.

## Architecture Rule

No Google Sheets. No Apps Script. No legacy fallback code.

Runtime data flows through:

- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Supabase Data API and RPCs
- Optional server-only workflow utilities under `workflows/`

The browser uses only `VITE_*` environment variables. Service-role credentials are server-only and must never be imported into `src/`.

## Project Structure

```txt
.
├── src/                 # Vite React LMS portal
├── workflows/domain/    # Retained Supabase workflow/domain code and Jest specs
├── scripts/             # Audits and SQL helper scripts
├── docs/                # Historical migration and operations notes
├── index.html
├── vite.config.ts
├── tsconfig*.json
└── package.json         # Single package boundary for install/build/dev
```

## First Milestones

1. Platform foundation and health checks.
2. Supabase Auth session verification.
3. Student dashboard read APIs.
4. Admin read APIs with pagination.
5. Project submissions.
6. Certificate generation and verification.
7. Support and notification workflows.
8. Load and security hardening.

## Commands

```bash
npm install
npm run dev
npm run build
npm run workflow:test
npm run lint
```

## Environment

Copy `.env.example` to `.env` and fill the values.

Privileged Supabase keys must remain server-only.
