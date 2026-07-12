# LMS Hostinger Staging Package - Student Dashboard Live Project Roles

Build date: 2026-07-10

## Contents

- `public_html/` contains the production frontend build from `npm run build`.
- Student Dashboard learner profile now shows assigned `Live Project Role` chips.
- The role section is hidden when the student has no assigned live project roles.
- Role names are resolved from active Admin Project Roles in `role_master`.
- This is display-only. It does not change student access, project eligibility, submissions, recordings, certificates, cohorts, or programs.

## Backend Notes

- Supabase migration applied:
  - `20260710132402_allow_students_read_active_role_labels.sql`
- Adds a narrow read policy so authenticated users can read active role labels from `role_master`.
- Existing admin manage policies remain unchanged.

## Verification

- `npm run lint` passed.
- `npm run build` passed.
- Live verification used the test student `skilledsapiens@gmail.com`:
  - temporarily assigned one active role ID
  - confirmed the student session could read the role label
  - restored the exact original value
  - final verification showed `live_project_role_ids = []`
