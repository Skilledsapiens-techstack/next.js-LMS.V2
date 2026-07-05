# Skilled Sapiens LMS Hostinger Package

Build: 2026-07-06 go-live LP project limit per cohort

## Included

- Default LP limit is now `1`.
- Admin LP Attempts modal now labels the value as `Max Projects per Cohort`.
- Student submission limit now counts different projects submitted within the selected cohort.
- Limit `1` means one project submission per cohort.
- Limit `2` means any two different project submissions per cohort.
- Resubmission is still allowed for the same project when latest status is `changes_requested`.

## Database

Applied Supabase migration:

- `20260706010500_set_lp_project_limit_default_one.sql`

Production verification:

- Existing saved LP limit rows: `1`
- Saved rows at limit `1`: `1`
- Students without saved rows use the new code default: `1`

## Verification

- `npm run lint`
- `npm run build`
