# LMS Hostinger Package - Session + Cohort Request Fix

Generated: 06 Jul 2026

## Scope

- Reuses the browser Supabase request client for the active access token to stop repeated GoTrue client creation warnings.
- Prevents Admin Students and Admin Certificates from requesting cohort page 2/3 unless the previous cohort page reports more data.
- Avoids the non-existent `cohorts` offset request that was producing `416 Range Not Satisfiable`.

## Supabase

- No database migration required.
- No Supabase function deployment required.

## Verification

- `npm run lint`
- `npm run build`
- `npm test -- --runInBand`

