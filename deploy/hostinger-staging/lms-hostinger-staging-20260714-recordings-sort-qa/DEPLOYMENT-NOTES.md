# Hostinger Package - Recordings Sort QA

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
- QA fix: updated the desktop toolbar grid so Search, Program, Cohort, and Sort by fit cleanly in one row where space allows.

## Backend Impact

- No Supabase migration required.
- No Edge Function deployment required.
- Frontend-only package.

## Verification

- `npm run lint` passed.
- `npm run build` passed.
- `npm test -- --runInBand` passed: 112 test suites, 454 tests.
- Production preview route redirects to login without a local admin session, so authenticated visual interaction was not completed on localhost.
