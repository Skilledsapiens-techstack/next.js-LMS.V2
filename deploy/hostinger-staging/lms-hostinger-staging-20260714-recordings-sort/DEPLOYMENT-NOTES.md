# Hostinger Package - Recordings Sort

Date: 2026-07-14

## Included Change

- Added a Sort by dropdown to the Admin Recordings module.
- Sort options:
  - Latest Updated
  - Session Date: Newest
  - Session Date: Oldest
  - Program A-Z
  - Cohort A-Z
- The selected sort applies consistently across Add Link, Pending Review, Published, and Rejected tabs.

## Backend Impact

- No Supabase migration required.
- No Edge Function deployment required.
- Frontend-only package.

## Verification

- `npm run lint` passed.
- `npm run build` passed.
- `npm test -- --runInBand` passed: 112 test suites, 454 tests.
