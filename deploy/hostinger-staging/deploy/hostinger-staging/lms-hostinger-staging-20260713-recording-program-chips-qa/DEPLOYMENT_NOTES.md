# LMS Hostinger Staging Package - Recording Program Chips QA

Generated: 2026-07-13

## Included changes

- Replaced the Watch Recordings enrolled-program dropdown with clickable program chips.
- Added an `All Recordings` chip and one chip per enrolled program.
- Added recording counts to each chip.
- Program chips now filter recordings through enrolled cohort names, matching the live recording data model.
- Kept recording visibility, paid/free access handling, locked states, and payment links unchanged.
- Includes the latest student program-name display fix and student filter cleanup from the current build.

## QA verification

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Local production preview served successfully.
- Headless Chrome smoke-tested the protected route and confirmed unauthenticated users route to login.
- Live read-only Supabase QA for `pgp26jonajoseph@imt.ac.in`:
  - All visible recordings: `8`
  - Sales & Marketing Leadership Program: `5`
  - Finance Leadership Program - ER: `4`

Note: Program counts can add up to more than the All count when a shared recording belongs to multiple enrolled program cohorts.

